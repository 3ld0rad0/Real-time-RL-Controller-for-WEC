import socket
import json
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from simulation.Oscillator import Oscillator
from simulation.Simulation import Simulation
from simulation.PM_Spectrum import PM_Spectrum
from simulation.server_utilities import init_simulation, init_SS, simulation_handler
import time
import numpy as np
import random

with open("./config.json", "r") as f:
    config = json.load(f)

HOST = config['host']  # Standard loopback interface address (localhost)
PORT = config['port']  # Port to listen on (non-privileged ports are > 1023)
TRAIN = config['train_model']

sim_train, sim_test = init_simulation(config)
period, Hw = init_SS(config)

print(
    f"Simulation started with these parameters:\n"
    f"Period       : {period} s\n"
    f"Wave height  : {Hw} m\n"
    f"Wave mode    : {'regular' if config['regular'] else 'irregular'}\n"
    f"Control mode : {config['control_mode']}\n"
)


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
    warmup_test = True
    with conn:
        print(f"Connected by {addr}\n")
        
        if TRAIN :
            print("Starting training simulation...")
            simulation_handler(conn, sim_train, warmup=True, show_results = True)
            warmup_test = False
            print("Training finished...")


        print("Starting test simulation...")
        simulation_handler(conn, sim_test, warmup= warmup_test, show_results= True)
        print("Testing finished...")

print('Close Server.')
    