import socket
import json
import os, sys, time
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from stable_baselines3 import PPO
import numpy as np
from agent.controller_utilities import init_env, training_handler, testing_handler, get_save_path


with open("config.json", "r") as f:
    config = json.load(f)

HOST = config['host']
PORT = config['port']
TRAIN = config['train_model']



with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
    try:
        s.connect((HOST, PORT))
        print("Connect to server...")
        
    
        model_path = get_save_path(config)
        response = s.recv(1024).decode().strip()
        warmup_values = json.loads(response)
        print('Warmup done...')
            
        env_train, env_test = init_env(config, warmup_values, s)

        if TRAIN:
            EPISODES = config['n_episodes']
            TIMESTEPS = config['n_steps']
            model = PPO("MlpPolicy", env_train, verbose=0)
            training_handler(model, s, TIMESTEPS, EPISODES, save_mode = True, save_path = model_path)
        
        try:
            model = PPO.load(model_path)
            print("Model loaded successfully...")
        
        except FileNotFoundError:
            print("Model not found, starting from scratch.")
            exit(1)

        time.sleep(1)
        testing_handler(env_test, model, s)

    except json.JSONDecodeError:
        print("Decode error in the response by the server...")
        #break
    except Exception as e:
        print(e)
        print("Connection close by the server...")
        #break

print("Close Client.")
