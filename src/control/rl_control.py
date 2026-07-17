import os
import sys
import numpy as np

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from stable_baselines3.common.callbacks import BaseCallback
from stable_baselines3.common.monitor import Monitor
from stable_baselines3 import PPO
from src.control.WEC_env import WECEnv_Linear, WECEnv_Latching
from src.network.client import UniversalClient, read_config_file, write_config_file, connection_handler
from src.control.base_controller import BaseController
import logging

logger = logging.getLogger(__name__)

class StopTrainingOnEpisodeCount(BaseCallback):
    def __init__(self, max_episodes, verbose=0):
        super().__init__(verbose)
        self.max_episodes = max_episodes
        self.episode_counter = 0

    def _on_step(self) -> bool:
        if self.locals.get("dones") is not None:
            num_dones = sum(self.locals["dones"])
            if num_dones > 0:
                self.episode_counter += num_dones
                
                # 1. Retrieve cumulative reward (check current infos first to avoid 1-episode lag)
                reward = 0.0
                ep_rewards = []
                for info in self.locals.get("infos", []):
                    if "episode" in info:
                        ep_rewards.append(info["episode"]["r"])
                
                if ep_rewards:
                    reward = float(np.mean(ep_rewards))
                elif len(self.model.ep_info_buffer) > 0:
                    reward = float(np.mean([ep_info['r'] for ep_info in self.model.ep_info_buffer]))
                
                # 2. Retrieve loss from name_to_value logger dictionary
                loss = float(self.logger.name_to_value.get("train/loss", 0.0))
                
                # Print directly to stdout for clean parsing by the frontend
                print(f"[METRICS] step={self.num_timesteps} episode={self.episode_counter} reward={reward:.6f} loss={loss:.6f}", flush=True)
                
        if self.episode_counter >= self.max_episodes:
            if self.verbose:
                logger.info(f"Stopping training after {self.episode_counter} episodes")
            return False
        return True


class RLController(BaseController):
    """
    Controllore basato su Reinforcement Learning (PPO).
    Sovrascrive i metodi train() e test() per utilizzare WECEnv e stable_baselines3.
    """
    
    def setup(self, config):
        self.model = None

    def act(self, state, time):
        # Il metodo act non viene utilizzato direttamente per l'RL in quanto
        # WECEnv gestisce internamente la trasformazione stato -> azione
        pass

    def get_save_path(self, config):
        c = config
        wave_mode = 'regular' if c['regular'] else 'irregular'
        sim = c.get("sim_name", "")
        dt_str = f"{c['d_t']}".replace(".", "")
        ft_suffix = "_fine_tuning" if c.get('retrain', False) else ""
        
        if c['mixed_sea_state']:
            model_name = f'ppomodel_sim{sim}_{c["control_mode"]}{ft_suffix}_{c["sim_time_train"]}h_{dt_str}s_{wave_mode}'
            base_path = f'./models/{wave_mode}/sea_state_mixed/simulation_{c["ent_coef"]}'
        else:
            nSS = c['init_SS_train']
            hw, period = c['wave_height_table'][nSS], c['period_table'][nSS]
            model_name = f'ppomodel_sim{sim}_{c["control_mode"]}{ft_suffix}_{c["sim_time_train"]}h_{dt_str}s_{float(hw)}_{float(period)}_{wave_mode}'
            base_path = f'./models/{wave_mode}/sea_state_{float(hw)}_{float(period)}/simulation_{c["ent_coef"]}'

        os.makedirs(base_path, exist_ok=True)
        return f'{base_path}/{model_name}'

    def receive_warmup_values(self, socket):
        try:
            return socket.recv_msg()
        except Exception as e:
            logger.error(f"Errore durante la ricezione dei warmup: {e}")
            return False

    def init_env(self, config, socket, mode):
        c = config
        sim_time = c['sim_time_train'] * 3600 if mode == 'train' else c['sim_time_test']
        
        # Calculate timesteps dynamically to avoid race conditions with server updating config.json
        if mode == 'train':
            timesteps = int((1 / c['d_t']) * sim_time)
            c['n_steps'] = timesteps
        else:
            timesteps = c['n_steps']
            
        episodes = np.ceil(np.max((4, timesteps / 1800)))
        
        # Preparazione stringhe per i path
        sim = c.get('sim_name', '')
        alg = ('rl' if c['rl_control'] else 'base') + ('ft' if c['retrain'] else '')
        wave = 'regular' if c['regular'] else 'irregular'
        dt_str = f"{c['d_t']}".replace(".", "")
        t_str = f"{c['sim_time_train']}h" if mode == 'train' else f"{c['sim_time_test']}s"
        
        if c['mixed_sea_state']:
            file_name = f'simulation_mixed{sim}_{c["control_mode"]}_{alg}_{t_str}_{dt_str}s_{wave}'
            base_name = f"{c['results_dir']}/{mode}/data/{wave}/sea_state_mixed"
        else:
            nSS = c['init_SS_train'] if mode == 'train' else c['init_SS_test']
            hw, period = c['wave_height_table'][nSS], c['period_table'][nSS]
            file_name = f'simulation{sim}_{c["control_mode"]}_{alg}_{t_str}_{dt_str}s_{float(hw)}_{float(period)}_{wave}'
            base_name = f"{c['results_dir']}/{mode}/data/{wave}/sea_state_{float(hw)}_{float(period)}"

        reward_path = f'{base_name}/{file_name}_reward.csv'
        
        c['n_episodes'] = episodes
        write_config_file(c, "./src/config/config.json")
        warmup_values = self.receive_warmup_values(socket)
        
        # Dati base per l'ambiente
        init_data = {
            "n_steps": timesteps,
            "n_episodes": episodes,
            "max_steps_per_episode": timesteps // episodes,
            "mixed_sea_state": c['mixed_sea_state']
        }

        if c['control_mode'] == 'linear':
            env = WECEnv_Linear(sim_time, warmup_values, socket, init_data, mode, reward_path)
        elif c['control_mode'] == 'latching':
            init_data.update({
                "fixed_G_star": c['fixed_G_star'],
                "opt_G_star": c['opt_G_star'],
                "init_G_star": c['init_G_star'],
                "alpha": c['alpha_latching'],
                "gamma": c['gamma_latching']
            })
            env = WECEnv_Latching(sim_time, warmup_values, socket, init_data, mode, reward_path)

        return env

    def _init_training(self, socket, config):
        """
        Inizializza l'ambiente e il modello per il training.
        """
        # Rilegge il config in caso sia mutato
        config = read_config_file("./src/config/config.json")
        retrain = config.get('retrain', False)
        model_retrain_path = config.get('retrain_path_model', "")
        ent_coef = config.get('ent_coef', 0.0)
        sim_name = config.get('sim_name', "")
        
        # Determine the save path for the model.
        # If we are retraining/fine-tuning, we must generate a new save path using get_save_path
        # to avoid overwriting the base model, since path_model is set to the base model's path.
        if retrain:
            model_path = self.get_save_path(config)
        else:
            model_path = self.get_save_path(config) if config['path_model'] == '' else config['path_model']
        self.model_path = model_path
        
        env_train = self.init_env(config, socket, mode='train')
        
        # Reload configuration to get synchronized episodes and timesteps
        config = read_config_file("./src/config/config.json")
        episodes = config['n_episodes']
        timesteps = config['n_steps']
        
        # Calculate steps per episode to use as rollout buffer size n_steps in PPO.
        # This triggers updates and loss calculations at the end of each episode done boundary.
        n_steps_ppo = int(timesteps // episodes)
        if n_steps_ppo < 32:
            n_steps_ppo = 32
            
        # Find a batch size that is an exact factor of n_steps_ppo, closest to 64
        possible_batch_sizes = [b for b in range(16, 257) if n_steps_ppo % b == 0]
        if possible_batch_sizes:
            batch_size_ppo = min(possible_batch_sizes, key=lambda x: abs(x - 64))
        else:
            batch_size_ppo = 64
            
        monitored_env = Monitor(env_train)
        
        if retrain and model_retrain_path != "":
            self.model = PPO.load(model_retrain_path, monitored_env, tensorboard_log=f"./board/ent_reg{ent_coef}/retrained/", verbose=0, device='cpu')
            self.model.n_steps = n_steps_ppo
            self.model.batch_size = batch_size_ppo
            self.model.rollout_buffer.buffer_size = n_steps_ppo
            self.model.rollout_buffer.reset()
            logger.debug("Model loaded successfully and ready for the fine tuning on a specified sea_state...")
        else:
            self.model = PPO("MlpPolicy", monitored_env, n_steps=n_steps_ppo, batch_size=batch_size_ppo, tensorboard_log=f"./board/ent_reg{ent_coef}/", ent_coef=ent_coef, verbose=0, device='cpu')
            
        return env_train, timesteps, episodes, sim_name, model_path

    def train(self, socket, config):
        """
        Sovrascrive il metodo train per lanciare PPO.learn.
        """
        env_train, timesteps, episodes, sim_name, model_path = self._init_training(socket, config)
        
        mode_label = "fine-tuning" if config.get('retrain', False) else "train"
        logger.info(f'Starting {mode_label} simulation...')
        self.model.learn(total_timesteps=timesteps, tb_log_name=f"simulation{sim_name}_PPO_log", callback=StopTrainingOnEpisodeCount(max_episodes=episodes, verbose=1))
        
        self.model.save(model_path)
        logger.critical(f"Model saved after {timesteps} timesteps.")
        
        env_train.close()

    def test(self, socket, config):
        """
        Sovrascrive il metodo test per lanciare PPO.predict tramite WECEnv.
        """
        config = read_config_file("./src/config/config.json")
        sim_name = config.get('sim_name', "")
        
        model_path = self.get_save_path(config) if config['path_model'] == '' else config['path_model']
        
        try:
            self.model = PPO.load(model_path, device='cpu')
            logger.info("Model loaded successfully...")
        except FileNotFoundError:
            logger.error("Model not found, starting from scratch.")
            exit(1)

        env_test = self.init_env(config, socket, mode='test')
        
        obs, info = env_test.reset()
        truncated = False

        logger.info(f'Starting test simulation...')
            
        while not truncated:
            action, _states = self.model.predict(obs)
            obs, rewards, terminated, truncated, info = env_test.step(action)

        logger.info(f"Test simulation completed...")
        env_test.close()
        logger.critical(f'Terminated Simulation{sim_name}...')

    def start(self, socket, config):
        self.setup(config)
        n_batch = config.get('batch_size', 1)
        
        for i in range(n_batch):
            config = read_config_file("./src/config/config.json")
            
            if config.get('train_model', False):
                self.train(socket, config)
                connection_handler(socket)
                
            self.test(socket, config)
            # L'ultimo connection_handler è gestito direttamente qui nel ciclo per evitare
            # di chiamarlo due volte in caso BaseController.start() provi a farlo (ma lo abbiamo sovrascritto)
            connection_handler(socket)

if __name__ == '__main__':
    agent = RLController()
    client = UniversalClient()
    client.run(agent.start)
