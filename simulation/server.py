import socket
import json
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from simulation.Oscillator import Oscillator
from simulation.Simulation import Simulation
import time
import numpy as np
import random

with open("./config.json", "r") as f:
    config = json.load(f)

HOST = config['host']  # Standard loopback interface address (localhost)
PORT = config['port']  # Port to listen on (non-privileged ports are > 1023)

C = config['init_C']
K = config['init_K']
G_STAR = config['init_G_star']
d_t = config['d_t']
sim_time = config['sim_time']
period = config['init_period']
period_bound = config['period_bound']
Hw = config['init_wave_height']
Hw_bound = config['wave_height_bound']
regular = config['regular']
control_mode = config['control_mode']
save_mode = config['save_mode']

oscillator = Oscillator(period, Hw, C, K, G_STAR, regular, sim_time, control_mode, d_t)
sim = Simulation(oscillator, sim_time, d_t, save_mode = save_mode)

print("Wait for warmup simulation...\n")

#sim.warmup(warmup_time = config['warmup_time'])

init_values = (period, Hw)
sim.load_warmup_values(init_values)

print(f"Simulation started with these parameters:")
print(f"Period : {period} s")
print(f"Wave height : {Hw} m")
print("Wave mode : regular") if regular else print("Wave_mode : irregular")
print(f"Control mode : {control_mode}\n")



config["n_steps"] = int((1/d_t) * sim_time)
# Salva di nuovo il file
with open("./config.json", "w") as f:
    json.dump(config, f, indent=2)

with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
    print('Waiting for controller connession...')
    s.bind((HOST, PORT))
    s.listen(1)
    #s.settimeout(30)
    
    try:
        conn, addr = s.accept()
    except socket.timeout:
        print('Timeout reached... closing the server')
        exit(1)
    
    #conn.settimeout(10)
    
    with conn:
        print(f"Connected by {addr}\n")

        warmup_values = sim.get_warmup_values()
        # print(f'Max heave :{warmup_values[0]} m')
        # print(f'Max velocity :{warmup_values[1]} m/s')
        conn.sendall((json.dumps(warmup_values) + "\n").encode())
        print('Send warmup values to controller...\n')
        
        start_t = time.time()
        print('Start simulation...')
        while sim.get_current_time() < sim_time:
            try:
                
                data = conn.recv(1024)
                if not data:
                    break

                # Decodifica JSON ricevuto
                try:
                    request = json.loads(data.decode().strip())
                
                except json.JSONDecodeError:
                    print("Errore nel JSON ricevuto")
                    continue

                cmd = request.get("cmd")

                if cmd == "get":
                    # Esegui passo di simulazione
                    payload = sim.step()
                    
                    progress = sim.get_current_time() / sim_time
                    bar_length = 30  # lunghezza della barra di avanzamento
                    block = int(bar_length * progress)
                    progress_bar = "[" + "#" * block + "-" * (bar_length - block) + "]"
                    percent = int(progress * 100)

                    print(f"\r{progress_bar} {percent}% - Tempo simulato: {sim.get_current_time():.1f}s", end="")

                    conn.sendall((json.dumps(payload) + "\n").encode())

                elif cmd == "control":
                    params = request.get("params", {})

                    # Esempio: modifica il coefficiente di smorzamento C
                    if control_mode == 'linear':
                        new_C = np.float64(params.get("C"))
                        new_K = np.float64(params.get("K"))
                        sim.send_control_linear((new_C, new_K))
                    
                    else:
                        new_u = np.float64(params.get("u"))
                        sim.send_control_latching(new_u)


                elif cmd == 'done':
                    # alla fine di ogni episodio aggiorna i valori di altezza d'onda e periodo
                    period = random.randint(period_bound[0], period_bound[1])
                    hw_arr = np.arange(Hw_bound[0], Hw_bound[1]+ 0.1, 0.5)
                    Hw = random.choice(hw_arr)
                    sim.update_values(period, Hw)

                else:
                    response = {"error": "Comando non riconosciuto"}
                    conn.sendall((json.dumps(response) + "\n").encode())

            except socket.timeout:
                print("Timeout: nessun comando ricevuto dal client.")
                exit(1)

            except Exception as e:
                exit(1)
        
        end_t = time.time()

        elapsed_time = np.round(end_t -start_t, 2)
        print()

        print('End simulation...')

        print(f"Elapsed real time : {elapsed_time} s")
        
        print('Plot results...')
        
        sim.plot()

        if not save_mode:
            sim.clear()

print('Close Server.')
    