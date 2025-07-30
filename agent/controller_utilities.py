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
    nSS = config['init_SS_train'] # il path del modello si riferisce al training
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

def init_env(config, socket, mode):
    
    sim_time = config['sim_time_train'] * 3600 if mode == 'train' else config['sim_time_test']
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

    if mode == 'train':
        file_name = f'simulation_{control_mode}_{str_sim}h_{f"{d_t}".replace('.','')}s_{init_hw}_{init_period}_{wave_mode}'
    
    else:
        file_name = f'simulation_{control_mode}_{str_sim}s_{f"{d_t}".replace('.','')}s_{init_hw}_{init_period}_{wave_mode}'

    base_name = f'./results/{mode}/data/{wave_mode}/sea_state_{init_hw}_{init_period}'
    
    reward_path  = f'{base_name}/{file_name}_reward.csv'

    config['n_episodes'] = episodes

    with open("./config.json", "w") as f:
        json.dump(config, f, indent=2)

    warmup_values = receive_warmup_values(socket)
    
    if control_mode == 'linear':
        
        init_data = {
            "n_steps": timesteps,
            "n_episodes": episodes,
            "max_steps_per_episode": timesteps//episodes
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
            print("Nessun ack di chiusura ricevuto.")
            return False

        request = json.loads(data.decode().strip())
        cmd = request.get("cmd")

        if cmd == "close":
            #print("Close message receive by the client...")
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
        #print("Close ack send to server....")
        return True
            
    except Exception as e:
        print("Errore durante l'invio del messaggio di chiusura:", e)
        return False

def connection_handler(socket):
    wait_close_message(socket)
    time.sleep(1)
    send_closeack_message(socket)

def training_handler(model, socket, timesteps, episodes, save_mode, save_path):
    print(f'Starting train simulation...')
    model.learn(total_timesteps= timesteps, tb_log_name = "PPO_log" ,callback=StopTrainingOnEpisodeCount(max_episodes= episodes, verbose=1))
    if save_mode:
        model.save(save_path)
        print(f"Model saved after {timesteps} timesteps.")
    
    connection_handler(socket)

def testing_handler(env_test, model, socket):
    obs, info = env_test.reset()
    truncated = False

    print(f'Starting test simulation...')
    #env_test.get_current_time() < env_test.get_t_final()
        
    while not truncated:
        action, _states = model.predict(obs)
        obs, rewards, terminated, truncated, info = env_test.step(action)

    print(f"Test simulation completed...")

    connection_handler(socket)


def receive_warmup_values(socket):
    try:
        response = socket.recv(1024).decode().strip()
        warmup_values = json.loads(response)
    
        #print('Warmup values received...')
        return warmup_values
    
    except json.JSONDecodeError:
        print("Errore nel parsing del JSON ricevuto.")
        return False
    except Exception as e:
        print(f"Errore durante la ricezione del messaggio di chiusura: {e}")
        return False
