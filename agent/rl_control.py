import socket
import json
import os, sys, time
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from agent.WEC_env import WECEnv_Linear, WECEnv_Latching
from stable_baselines3 import PPO
import numpy as np
from agent.controller_utilities import StopTrainingOnEpisodeCount, init_env, close_connection


with open("config.json", "r") as f:
    config = json.load(f)

HOST = config['host']
PORT = config['port']
EPISODES = config['n_episodes']
TIMESTEPS = config['n_steps']
TRAIN = config['train_model']

# sim_time_train = config['sim_time_train'] * 3600 # Convert hours to seconds
# sim_time_test = config['sim_time_test'] * 3600  # Convert hours to seconds
# train = False
# timesteps = config['n_steps']
# episodes = np.ceil(np.max((4, timesteps/2500)))
# control_mode = config['control_mode']

# config['n_episodes'] = episodes

# with open("./config.json", "w") as f:
#     json.dump(config, f, indent=2)

with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
    try:
        s.connect((HOST, PORT))
        print("Connect to server...")
        
        # Wait for warmup values
        response = s.recv(1024).decode().strip()
        warmup_values = json.loads(response)
        print('Warmup done...')
        
        env_train, env_test = init_env(config, warmup_values, s)
        # if control_mode == 'linear':
        #     env_train = WECEnv_Linear(sim_time_train, warmup_values, s, config)
        #     env_test = WECEnv_Linear(sim_time_test, warmup_values, s, config)
        
        # elif control_mode == 'latching':
        #     env_train = WECEnv_Latching(sim_time_train, warmup_values, s, config, fixed_G_star = config['fixed_G_star'])
        #     env_test = WECEnv_Latching(sim_time_test, warmup_values, s, config, fixed_G_star = config['fixed_G_star'])


        if TRAIN:
            model = PPO("MlpPolicy", env_train, verbose=0)
            model.learn(total_timesteps= TIMESTEPS, callback=StopTrainingOnEpisodeCount(max_episodes= EPISODES, verbose=1))
            model.save("ppo_model")
            print(f"Model saved after {TIMESTEPS} timesteps.")
        
        try:
            model = PPO.load("ppo_model")
            print("Model loaded successfully...")
        
        except FileNotFoundError:
            print("Model not found, starting from scratch.")
        
        obs = env_test.reset()

        print(f'Starting test simulation...')
        
        while env_test.get_current_time() < env_test.get_t_final():
            action, _states = model.predict(obs)
            obs, rewards, dones, info = env_test.step(action)

        print(f"Test simulation completed...")
        time.sleep(1)
        
        close_connection(s)

    except json.JSONDecodeError:
        print("Decode error in the response by the server...")
        #break
    except Exception as e:
        print(e)
        print("Connection close by the server...")
        #break

print("Close Client.")
