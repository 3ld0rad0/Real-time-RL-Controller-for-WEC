import socket
import json
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from simulation.Oscillator import Oscillator
from simulation.Simulation import Simulation
from simulation.PM_Spectrum import PM_Spectrum
from utils.server_utilities import init_simulation, init_SS, simulation_handler, send_warmup_values
import time
import numpy as np
import random

with open("./utils/config.json", "r") as f:
    config = json.load(f)

HOST = config['host']  # Standard loopback interface address (localhost)
PORT = config['port']  # Port to listen on (non-privileged ports are > 1023)
TRAIN = config['train_model']

sim_train, sim_test = init_simulation(config)
period_train, Hw_train, period_test, Hw_test = init_SS(config)



with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
    print('Waiting for controller connession...')
    s.bind((HOST, PORT))
    s.listen(1)
    s.settimeout(15)
    
    try:
        conn, addr = s.accept()
    except socket.timeout:
        print('Timeout reached... closing the server')
        exit(1)
    
    #conn.settimeout(10)
    with conn:
        print(f"Connected by {addr}\n")
        
        if TRAIN :
            print(
                f"Training Simulation started with these parameters:\n"
                f"Period       : {period_train} s\n"
                f"Wave height  : {Hw_train} m\n"
                f"Wave mode    : {'regular' if config['regular'] else 'irregular'}\n"
                f"Control mode : {config['control_mode']}\n"
            )               
            simulation_handler(conn, sim_train, show_results = True)
            print("Training Simulation finished...\n")

        print(
            f"Testing Simulation started with these parameters:\n"
            f"Period       : {period_test} s\n"
            f"Wave height  : {Hw_test} m\n"
            f"Wave mode    : {'regular' if config['regular'] else 'irregular'}\n"
            f"Control mode : {config['control_mode']}\n"
        )     
        simulation_handler(conn, sim_test, show_results= True)
        print("Testing Simulation finished...\n")

print('Close Server.')
    