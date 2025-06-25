import socket
import json
import os, sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from agent.WEC_env import WECEnv_Linear, WECEnv_Latching
from stable_baselines3 import PPO


with open("config.json", "r") as f:
    config = json.load(f)

HOST = config['host']
PORT = config['port']

sim_time = config['sim_time']
train = True
timesteps = config['n_steps']
control_mode = config['control_mode']

with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
    try:
        s.connect((HOST, PORT))
        print("Connect to server...")
        
        # Wait for warmup values
        response = s.recv(1024).decode().strip()
        warmup_values = json.loads(response)
        print('Warmup done...')
        
        if control_mode == 'linear':
            env = WECEnv_Linear(sim_time, warmup_values, s, config)
        
        elif control_mode == 'latching':
            env = WECEnv_Latching(sim_time, warmup_values, s, config)

        model = PPO("MlpPolicy", env, verbose=1)

        if train:
            model.learn(total_timesteps= timesteps)

    except json.JSONDecodeError:
        print("Decode error in the response by the server...")
        #break
    except Exception as e:
        #print(e)
        print("Connection close by the server...")
        #break

print("Close Client.")
