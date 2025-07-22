import os,sys,json
import numpy as np
import time
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
    
def get_save_path(config):
    control_mode = config['control_mode']
    str_train = str(config['sim_time_train'])
    d_t = config['d_t']
    nSS = config['init_SS']
    period_table = config['period_table']
    init_period = period_table[nSS]
    hw_table = config['wave_height_table']
    init_hw = hw_table[nSS]
    wave_mode = 'regular' if config['regular'] else 'irregular'

    model_name = f'ppomodel_{control_mode}_{str_train}h_{f"{d_t}".replace('.','')}s_{init_hw}_{init_period}_{wave_mode}'
    base_path = f'./models/{wave_mode}/sea_state_{init_hw}_{init_period}'
    
    if not os.path.exists(base_path):
        os.makedirs(base_path)
    
    model_path  = f'{base_path}/{model_name}'


    return model_path

def init_env(config, warmup_values, socket):
    
    sim_time_train = config['sim_time_train'] * 3600 # Convert hours to seconds
    sim_time_test = config['sim_time_test'] * 3600  # Convert hours to seconds
    timesteps = config['n_steps']
    episodes = np.ceil(np.max((4, timesteps/1800)))
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
    
    base_name_train = f'./results/train/data/{wave_mode}/sea_state_{init_hw}_{init_period}'
    base_name_test = f'./results/test/data/{wave_mode}/sea_state_{init_hw}_{init_period}'
    
    reward_path_train  = f'{base_name_train}/{file_name_train}_reward.csv'
    reward_path_test  = f'{base_name_test}/{file_name_test}_reward.csv'

    config['n_episodes'] = episodes

    with open("./config.json", "w") as f:
        json.dump(config, f, indent=2)


    
    if control_mode == 'linear':
        
        init_data = {
            "n_steps": timesteps,
            "n_episodes": episodes,
            "max_steps_per_episode": timesteps//episodes
        }
        env_train = WECEnv_Linear(sim_time_train, warmup_values, socket, init_data, sim_mode = 'train', reward_file_path=reward_path_train)
        env_test = WECEnv_Linear(sim_time_test, warmup_values, socket, init_data, sim_mode = 'test', reward_file_path=reward_path_test)

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
        env_train = WECEnv_Latching(sim_time_train, warmup_values, socket, init_data, sim_mode = 'train', reward_file_path=reward_path_train)
        env_test = WECEnv_Latching(sim_time_test, warmup_values, socket, init_data, sim_mode = 'test', reward_file_path=reward_path_test)

    
    return env_train, env_test

def wait_close_message(socket):
    try:
        data = socket.recv(1024)
        if not data:
            print("Nessun ack di chiusura ricevuto.")
            return False

        request = json.loads(data.decode().strip())
        cmd = request.get("cmd")

        if cmd == "close":
            print("Close message receive by the client...")
            time.sleep(1)
            return True
        else:
            print(f"Comando sconosciuto ricevuto: {cmd}")
            return False

    except json.JSONDecodeError:
        print("Errore nel parsing del JSON ricevuto.")
        return False
    except Exception as e:
        print(f"Errore durante la ricezione del messaggio di chiusura: {e}")
        return False

def send_closeack_message(socket):
    try:
        ack_message = json.dumps({"cmd": "ack-close"}).encode()
        socket.sendall(ack_message)
        print("Close ack send to server....")
        return True
            
    except Exception as e:
        print("Errore durante l'invio del messaggio di chiusura:", e)
        return False

def connection_handler(socket):
    wait_close_message(socket)
    time.sleep(1)
    send_closeack_message(socket)

def training_handler(model, socket, timesteps, episodes, save_mode, save_path):
    model.learn(total_timesteps= timesteps, callback=StopTrainingOnEpisodeCount(max_episodes= episodes, verbose=1))
    if save_mode:
        model.save(save_path)
        print(f"Model saved after {timesteps} timesteps.")
    
    connection_handler(socket)

def testing_handler(env_test, model, socket):
    obs = env_test.reset()

    print(f'Starting test simulation...')
        
    while env_test.get_current_time() < env_test.get_t_final():
        action, _states = model.predict(obs)
        obs, rewards, dones, info = env_test.step(action)

    print(f"Test simulation completed...")

    connection_handler(socket)
