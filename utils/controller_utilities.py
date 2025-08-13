import os,sys,json
import numpy as np
import time
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from stable_baselines3.common.callbacks import BaseCallback
from stable_baselines3 import PPO
from stable_baselines3.common.env_checker import check_env
from agent.WEC_env import WECEnv_Linear, WECEnv_Latching
import logging

logger = logging.getLogger(__name__)
    
class StopTrainingOnEpisodeCount(BaseCallback):
    def __init__(self, max_episodes, verbose=0):
        super().__init__(verbose)
        self.max_episodes = max_episodes
        self.episode_counter = 0

    def _on_step(self) -> bool:
        # SB3 salva info episodio qui
        #print(f"Timestep: {self.num_timesteps}")
        if self.locals.get("dones") is not None:
            self.episode_counter += sum(self.locals["dones"])
        if self.episode_counter >= self.max_episodes:
            if self.verbose:
                logger.info(f"Stopping training after {self.episode_counter} episodes")
            return False  # Stop training
        return True
    
def get_save_path(config):
    control_mode = config['control_mode']
    str_train = str(config['sim_time_train'])
    d_t = config['d_t']
    nSS = config['init_SS_train'] # il path del modello si riferisce al training
    period_table = config['period_table']
    init_period = period_table[nSS]
    hw_table = config['wave_height_table']
    init_hw = hw_table[nSS]
    wave_mode = 'regular' if config['regular'] else 'irregular'
    sim_name = config["sim_name"]
    mixed_sea_state = config['mixed_sea_state']

    model_name_single = f'ppomodel_sim{sim_name}_{control_mode}_{str_train}h_{f"{d_t}".replace('.','')}s_{init_hw}_{init_period}_{wave_mode}'
    base_path_single = f'./models/{wave_mode}/sea_state_{init_hw}_{init_period}/simulation_{config['ent_coef']}'
    
    model_name_mixed = f'ppomodel_sim{sim_name}_{control_mode}_{str_train}h_{f"{d_t}".replace('.','')}s_{wave_mode}'
    base_path_mixed = f'./models/{wave_mode}/sea_state_mixed/simulation_{config['ent_coef']}'

    model_name = model_name_mixed if mixed_sea_state else model_name_single
    base_path = base_path_mixed if mixed_sea_state else base_path_single

    if not os.path.exists(base_path):
        os.makedirs(base_path)
    
    model_path  = f'{base_path}/{model_name}'


    return model_path

def init_env(config, socket, mode):
    
    sim_time = config['sim_time_train'] * 3600 if mode == 'train' else config['sim_time_test']
    sim_name = config['sim_name']
    timesteps = config['n_steps']
    episodes = np.ceil(np.max((4, timesteps/1800)))
    control_mode = config['control_mode']
    wave_mode = 'regular' if config['regular'] else 'irregular'
    nSS = config['init_SS_train'] if mode == 'train' else config['init_SS_test']
    period_table = config['period_table']
    init_period = period_table[nSS]
    hw_table = config['wave_height_table']
    init_hw = hw_table[nSS]
    d_t = config['d_t']
    fixed_G_star = config['fixed_G_star']
    opt_G_star = config['opt_G_star']
    init_G_star = config['init_G_star']
    alpha = config['alpha_latching']
    beta = config['beta_latching']
    gamma = config['gamma_latching']
    str_sim = str(config['sim_time_train']) if mode == 'train' else str(config['sim_time_test'])
    sim_dir = config['results_dir']
    mixed_sea_state = config['mixed_sea_state']

    file_name_single = ""
    file_name_mixed = ""

    if mode == 'train':
        file_name_single = f'simulation{sim_name}_{control_mode}_{str_sim}h_{f"{d_t}".replace('.','')}s_{init_hw}_{init_period}_{wave_mode}'
        file_name_mixed = f'simulation_mixed{sim_name}_{control_mode}_{str_sim}h_{f"{d_t}".replace('.','')}s_{wave_mode}'
    
    else:
        file_name_single = f'simulation{sim_name}_{control_mode}_{str_sim}s_{f"{d_t}".replace('.','')}s_{init_hw}_{init_period}_{wave_mode}'
        file_name_mixed = f'simulation_mixed{sim_name}_{control_mode}_{str_sim}s_{f"{d_t}".replace('.','')}s_{wave_mode}'

    file_name = file_name_mixed if mixed_sea_state else file_name_single

    base_name_single = f'{sim_dir}/{mode}/data/{wave_mode}/sea_state_{init_hw}_{init_period}'
    base_name_mixed = f'{sim_dir}/{mode}/data/{wave_mode}/sea_state_mixed'

    base_name = base_name_mixed if mixed_sea_state else base_name_single
    
    reward_path  = f'{base_name}/{file_name}_reward.csv'

    config['n_episodes'] = episodes

    write_config_file(config)

    warmup_values = receive_warmup_values(socket)
    
    if control_mode == 'linear':
        
        init_data = {
            "n_steps": timesteps,
            "n_episodes": episodes,
            "max_steps_per_episode": timesteps//episodes,
            "mixed_sea_state" : mixed_sea_state
        }
        sim_mode = mode
        env = WECEnv_Linear(sim_time, warmup_values, socket, init_data, sim_mode, reward_file_path=reward_path)

    elif control_mode == 'latching':
        
        init_data = {
            "n_steps": timesteps,
            "n_episodes": episodes,
            "max_steps_per_episode": timesteps//episodes,
            "fixed_G_star": fixed_G_star,
            "opt_G_star": opt_G_star,
            "init_G_star": init_G_star,
            "mixed_sea_state" : mixed_sea_state,
            "alpha": alpha,
            "beta": beta,
            "gamma": gamma
        }

        sim_mode = mode
        env = WECEnv_Latching(sim_time, warmup_values, socket, init_data, sim_mode, reward_file_path=reward_path)

    return env

def wait_close_message(socket):
    try:
        data = socket.recv(1024)
        if not data:
            logger.error("Nessun ack di chiusura ricevuto.")
            return False

        request = json.loads(data.decode().strip())
        cmd = request.get("cmd")
        #energy_absorbed = request.get("energy_abs")

        if cmd == "close":
            #print("Close message receive by the client...")
            time.sleep(1)
            return True
        else:
            logger.error(f"Comando sconosciuto ricevuto: {cmd}")
            return False

    except json.JSONDecodeError:
        logger.error("Errore nel parsing del JSON ricevuto.")
        return False
    except Exception as e:
        logger.error(f"Errore durante la ricezione del messaggio di chiusura: {e}")
        return False

def send_closeack_message(socket):
    try:
        ack_message = json.dumps({"cmd": "ack-close"}).encode()
        socket.sendall(ack_message)
        #print("Close ack send to server....")
        return True
            
    except Exception as e:
        logger.error("Errore durante l'invio del messaggio di chiusura:", e)
        return False

def connection_handler(socket):
    wait_close_message(socket)
    time.sleep(1)
    send_closeack_message(socket)

def training_handler(model, socket, timesteps, episodes, save_mode, save_path, sim_name):
    logger.info(f'Starting train simulation...')
    model.learn(total_timesteps= timesteps, tb_log_name = f"simulation{sim_name}_PPO_log" ,callback=StopTrainingOnEpisodeCount(max_episodes= episodes, verbose=1))
    if save_mode:
        model.save(save_path)
        logger.info(f"Model saved after {timesteps} timesteps.")
    
    connection_handler(socket)

def testing_handler(env_test, model, socket):
    obs, info = env_test.reset()
    truncated = False

    logger.info(f'Starting test simulation...')
    #env_test.get_current_time() < env_test.get_t_final()
        
    while not truncated:
        action, _states = model.predict(obs)
        obs, rewards, terminated, truncated, info = env_test.step(action)

    logger.info(f"Test simulation completed...")

    connection_handler(socket)


def receive_warmup_values(socket):
    try:
        response = socket.recv(1024).decode().strip()
        warmup_values = json.loads(response)
    
        #print('Warmup values received...')
        return warmup_values
    
    except json.JSONDecodeError:
        logger.error("Errore nel parsing del JSON ricevuto.")
        return False
    except Exception as e:
        logger.error(f"Errore durante la ricezione del messaggio di chiusura: {e}")
        return False


def read_config_file(file = "./utils/config.json"):
    with open(file, "r") as f:
        config = json.load(f)

    return config

def write_config_file(data, file = "./utils/config.json"):
    with open(file, "w") as f:
        json.dump(data, f, indent=2)

def start_batch_control(s, n_batch, train_mode, retrain, model_retrain_path, ent_coef):
        
        for i in range(n_batch):
            time.sleep(3)
            logger.info(f'batch{i+1}')
            config = read_config_file()
            model_path = get_save_path(config)
            sim_name = config['sim_name']

            if train_mode:
                env_train = init_env(config, s, mode = 'train')
                check_env(env_train)

                EPISODES = config['n_episodes']
                TIMESTEPS = config['n_steps']
                
                if retrain:
                    model = PPO.load(model_retrain_path, env_train, tensorboard_log = f"./board/ent_reg{ent_coef}/retrained/", verbose = 0)
                else:
                    model = PPO("MlpPolicy", env_train, tensorboard_log = f"./board/ent_reg{ent_coef}/", ent_coef = ent_coef, verbose=0)
                
                training_handler(model, s, TIMESTEPS, EPISODES, save_mode = True, save_path = model_path, sim_name = sim_name)
                env_train.close()
            
            try:
                model = PPO.load(model_path)
                logger.info("Model loaded successfully...")
            
            except FileNotFoundError:
                logger.error("Model not found, starting from scratch.")
                exit(1)

            time.sleep(1)
            env_test = init_env(config, s, mode = 'test')
            check_env(env_test)
            
            testing_handler(env_test, model, s)
            env_test.close()
            logger.critical(f'Terminated Simulation{sim_name}...')
