import numpy as np
import json
import sys
import os
import socket
import time
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from simulation.Oscillator import Oscillator
from simulation.PM_Spectrum import PM_Spectrum
from simulation.Simulation import Simulation



def init_simulation(config):

    C = config['init_C']
    K = config['init_K']
    G_STAR = config['init_G_star']
    d_t = config['d_t']
    sim_time_train = config['sim_time_train'] * 3600  # Convert hours to seconds
    sim_time_test = config['sim_time_test'] * 3600  # Convert hours to seconds
    nSS = config['init_SS']
    period_bound = config['period_table']
    period = period_bound[nSS]
    Hw_bound = config['wave_height_table']
    Hw = Hw_bound[nSS]
    regular = config['regular']
    control_mode = config['control_mode']
    spectral_input = None
    save_mode = config['save_mode']
    
    if not regular:
        pm = PM_Spectrum()
        nω = 50  # Number of frequency components
        ω_min = 2.0 * np.pi / 18.0
        ω_max = 2.0 * np.pi / 4.0
        Te, Hs, A_ω, ω, φ = pm.Amp_Phase(nSS, nω, ω_min, ω_max)
        spectral_input = (A_ω, ω, φ)

    oscillator_train = Oscillator(period, Hw, C, K, G_STAR, regular, sim_time_train, control_mode, d_t, spectral_input)
    oscillator_test = Oscillator(period, Hw, C, K, G_STAR, regular, sim_time_test, control_mode, d_t, spectral_input)

    sim_train = Simulation(oscillator_train, save_mode = save_mode)
    sim_test = Simulation(oscillator_test, save_mode = save_mode)


    init_values = (period, Hw)
    sim_train.load_warmup_values(init_values)
    sim_test.load_warmup_values(init_values)

    config["n_steps"] = int((1/d_t) * sim_time_train)  # Update n_steps based on simulation time and time step
    # Salva di nuovo il file
    with open("./config.json", "w") as f:
        json.dump(config, f, indent=2)
    
    return sim_train, sim_test

def init_SS(config):
    nSS = config['init_SS']
    period_bound = config['period_table']
    period = period_bound[nSS]
    Hw_bound = config['wave_height_table']
    Hw = Hw_bound[nSS]

    return period, Hw

def wait_close_message(conn):
    try:
        data = conn.recv(1024)
        if not data:
            print("Nessun messaggio ricevuto per la chiusura.")
            return False

        request = json.loads(data.decode().strip())
        cmd = request.get("cmd")

        if cmd == "close":
            print("Close message receive by the client...")
            print("Send close ack to client...")
            time.sleep(1)  # Attendi un attimo prima di rispondere
            conn.sendall(b"Server close.\n")
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


def simulation_step(conn, sim):
    data = conn.recv(1024)
    if not data:
        print('No data received...')
        return
          # Decodifica JSON ricevuto
    try:
        request = json.loads(data.decode().strip())
                
    except json.JSONDecodeError:
        print("Errore nel JSON ricevuto")

    cmd = request.get("cmd")

    if cmd == "get":
        # Esegui passo di simulazione
        payload = sim.step()
        curr_time = sim.get_current_time()
        progress = curr_time / sim.get_sim_time()
        
        bar_length = 30  # lunghezza della barra di avanzamento
        block = int(bar_length * progress)
        progress_bar = "[" + "#" * block + "-" * (bar_length - block) + "]"
        percent = int(progress * 100)

        print(f"\r{progress_bar} {percent}% - Tempo simulato: {curr_time:.1f}s", end="")

        conn.sendall((json.dumps(payload) + "\n").encode())

    elif cmd == "control":
        params = request.get("params", {})

        # Esempio: modifica il coefficiente di smorzamento C
        if sim.get_control_mode() == 'linear':
            new_C = np.float64(params.get("C"))
            new_K = np.float64(params.get("K"))
            sim.send_control_linear((new_C, new_K))
                    
        else:
            new_u = np.float64(params.get("u"))
            new_G_star = np.float64(params.get("G_star"))
            sim.send_control_latching((new_u, new_G_star))


    # elif cmd == 'done':
    #     # alla fine di ogni episodio aggiorna i valori di altezza d'onda e periodo
    #     period = random.randint(period_bound[0], period_bound[len(period_bound) - 1])
    #     hw_arr = np.arange(Hw_bound[0], Hw_bound[len(period_bound) - 1]+ 0.1, 0.5)
    #     Hw = random.choice(hw_arr)
    #     sim_train.update_values(period, Hw)

    else:
        response = {"error": "Comando non riconosciuto"}
        conn.sendall((json.dumps(response) + "\n").encode())


def start_simulation(conn, sim, show_results = True):

    warmup_values = sim.get_warmup_values()
    # print(f'Max heave :{warmup_values[0]} m')
    # print(f'Max velocity :{warmup_values[1]} m/s')
    conn.sendall((json.dumps(warmup_values) + "\n").encode())
    print('Send warmup values to controller...\n')
    print('Start simulation...')
    start_t = time.time()
    t_final = sim.get_sim_time()
        
    while sim.get_current_time() < t_final:
        try:
            simulation_step(conn, sim)

        except socket.timeout:
            print("Timeout: nessun comando ricevuto dal client.")
            exit(1)

        except Exception as e:
            exit(1)
        
    end_t = time.time()

    elapsed_time = np.round(end_t -start_t, 2)

    print()
    print(
        f"End simulation...\n"
        f"Elapsed real time : {elapsed_time} s\n"
        f"Save results and plots...\n"
    )

    if show_results:
        sim.plot()

    if not sim.get_save_mode():
        sim.clear()

    


    