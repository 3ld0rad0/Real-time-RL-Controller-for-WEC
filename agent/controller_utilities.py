import os,sys,json
import numpy as np
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from stable_baselines3.common.callbacks import BaseCallback
from agent.WEC_env import WECEnv_Linear, WECEnv_Latching
    
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
                print(f"Stopping training after {self.episode_counter} episodes")
            return False  # Stop training
        return True


def init_env(config, warmup_values, socket):
    
    sim_time_train = config['sim_time_train'] * 3600 # Convert hours to seconds
    sim_time_test = config['sim_time_test'] * 3600  # Convert hours to seconds
    train = config['train_model']
    timesteps = config['n_steps']
    episodes = np.ceil(np.max((4, timesteps/2500)))
    control_mode = config['control_mode']
    wave_mode = 'regular' if config['regular'] else 'irregular'
    nSS = config['init_SS']
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
    str_train = str(config['sim_time_train'])
    str_test = str(config['sim_time_test'])
            
    file_name_train = f'simulation_{control_mode}_{str_train}h_{f"{d_t}".replace('.','')}s_{init_hw}_{init_period}_{wave_mode}'
    file_name_test = f'simulation_{control_mode}_{str_test}h_{f"{d_t}".replace('.','')}s_{init_hw}_{init_period}_{wave_mode}'
    
    base_name = f'./results/data/{wave_mode}/sea_state_{init_hw}_{init_period}'
    
    reward_path_train  = f'{base_name}/{file_name_train}_reward.csv'
    reward_path_test  = f'{base_name}/{file_name_test}_reward.csv'

    config['n_episodes'] = episodes

    with open("./config.json", "w") as f:
        json.dump(config, f, indent=2)


    
    if control_mode == 'linear':
        
        init_data = {
            "n_steps": timesteps,
            "n_episodes": episodes,
            "max_steps_per_episode": timesteps//episodes,
        }
        env_train = WECEnv_Linear(sim_time_train, warmup_values, socket, init_data, reward_file_path=reward_path_train)
        env_test = WECEnv_Linear(sim_time_test, warmup_values, socket, init_data, reward_file_path=reward_path_test)

    elif control_mode == 'latching':
        
        init_data = {
            "n_steps": timesteps,
            "n_episodes": episodes,
            "max_steps_per_episode": timesteps//episodes,
            "fixed_G_star": fixed_G_star,
            "opt_G_star": opt_G_star,
            "init_G_star": init_G_star,
            "alpha": alpha,
            "beta": beta,
            "gamma": gamma
        }
        env_train = WECEnv_Latching(sim_time_train, warmup_values, socket, init_data, reward_file_path=reward_path_train)
        env_test = WECEnv_Latching(sim_time_test, warmup_values, socket, init_data, reward_file_path=reward_path_test)

    
    return env_train, env_test

def close_connection(socket):
    try:
        close_message = json.dumps({"cmd": "close"}).encode()
        socket.sendall(close_message)
        print("Close message send to server....")
                
        response = socket.recv(1024).decode().strip()
        print("Server close-ack:", response)
        exit(0)
            
    except Exception as e:
        print("Errore durante l'invio del messaggio di chiusura:", e)
        exit(1)