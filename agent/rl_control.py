import socket
import json
import os, sys, time
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from stable_baselines3 import PPO
from stable_baselines3.common.env_checker import check_env
import numpy as np
from agent.controller_utilities import init_env, training_handler, testing_handler, get_save_path, receive_warmup_values


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

        if TRAIN:
            env_train = init_env(config, s, mode = 'train')
            check_env(env_train)

            EPISODES = config['n_episodes']
            TIMESTEPS = config['n_steps']
            model = PPO("MlpPolicy", env_train, tensorboard_log = "./board/", verbose=0)
            training_handler(model, s, TIMESTEPS, EPISODES, save_mode = True, save_path = model_path)
            env_train.close()
        
        try:
            model = PPO.load(model_path)
            print("Model loaded successfully...")
        
        except FileNotFoundError:
            print("Model not found, starting from scratch.")
            exit(1)

        time.sleep(1)
        env_test = init_env(config, s, mode = 'test')
        check_env(env_test)
        testing_handler(env_test, model, s)
        env_test.close()

    except json.JSONDecodeError:
        print("Decode error in the response by the server...")
        #break
    except Exception as e:
        print(e)
        print("Connection close by the server...")
        #break

print("Close Client.")
