import numpy as np
import json
import sys
import os
import socket
import time
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from simulation.Oscillator import Oscillator
from simulation.Simulation import Simulation
import logging
import pandas as pd
from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, TextColumn, BarColumn, TaskProgressColumn, TimeElapsedColumn, TimeRemainingColumn

logger = logging.getLogger(__name__)
console = Console()



def init_SS(sim_train, sim_test):
    
    if sim_train != None:
        period_train = sim_train.get_oscillator().get_period()
        Hw_train = sim_train.get_oscillator().get_wave_height()
    else:
        period_train = None
        Hw_train = None
    period_test = sim_test.get_oscillator().get_period()
    Hw_test = sim_test.get_oscillator().get_wave_height()
    
    return period_train, Hw_train, period_test, Hw_test

def init_simulation(config):

    C = config['init_C']
    C_STAR = config['init_C_star']
    K = config['init_K']
    G_STAR = config['init_G_star']
    d_t = config['d_t']
    sim_time_train = config['sim_time_train'] * 3600  # Convert hours to seconds
    sim_name = config['sim_name'] 
    sim_time_test = config['sim_time_test'] # Already in seconds
    nSS_train = config['init_SS_train']
    nSS_test = config['init_SS_test']
    regular = config['regular']
    control_mode = config['control_mode']
    control_alg = 'rl' if config['rl_control'] else 'base'
    fine_tune = 'ft' if config['retrain'] else ''
    control_alg = control_alg + fine_tune
    save_mode = config['save_mode']
    show_results = config['show_results']
    sim_dir = config['results_dir']
    mixed_sea_state = config['mixed_sea_state']
    

    oscillator_train = Oscillator(C, C_STAR, K, G_STAR, regular, sim_time_train, control_mode, d_t, nSS_train, seed_spectrum = 17)
    oscillator_test = Oscillator(C, C_STAR,K, G_STAR, regular, sim_time_test, control_mode, d_t, nSS_test, seed_spectrum = 123)

    sim_train = Simulation(oscillator_train, save_mode, 'train', control_alg, sim_name, sim_dir, show_results, mixed_sea_state)
    sim_test = Simulation(oscillator_test, save_mode, 'test', control_alg, sim_name, sim_dir, show_results, mixed_sea_state)

    period_train = oscillator_train.get_period()
    period_test = oscillator_test.get_period()
    Hw_train = oscillator_train.get_wave_height()
    Hw_test = oscillator_test.get_wave_height()
    init_values_train = (period_train, Hw_train)
    init_values_test = (period_test, Hw_test)
    sim_train.load_warmup_values(init_values_train)
    sim_test.load_warmup_values(init_values_test)

    config["n_steps"] = int((1/d_t) * sim_time_train)  # Update n_steps based on simulation time and time step
    config["sim_name"] = sim_name
    
    # Salva di nuovo il file
    with open("./utils/config.json", "w") as f:
        json.dump(config, f, indent=2)
    
    return sim_train, sim_test


def simulation_handler(conn, sim, control):
    start_t = time.time()
    start_simulation(conn, sim, control)
    end_t = time.time()
    elapsed_time = np.round(end_t -start_t, 2)
    energy = close_simulation(conn, sim, elapsed_time)
    
    return energy

def start_simulation(conn, sim, control):
    
    if control == 'rl':
        send_warmup_values(sim,conn)
    
    t_final = sim.get_sim_time()
        
    with Progress(
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TaskProgressColumn(),
        "•",
        TimeElapsedColumn(),
        "•",
        TimeRemainingColumn(),
        transient=True,
    ) as progress:
        task_desc = f"[cyan]Simulating ({sim.get_sim_mode()})..."
        task_id = progress.add_task(task_desc, total=t_final)
        
        while sim.get_current_time() < t_final:
            try:
                simulation_step(conn, sim)
                progress.update(task_id, completed=sim.get_current_time())
            except socket.timeout:
                logger.error("Timeout: nessun comando ricevuto dal client.")
                exit(1)
            except Exception as e:
                exit(1)


def simulation_step(conn, sim):
    data = conn.recv(1024)
    if not data:
        logger.error('No data received... close connection')
        raise Exception
          # Decodifica JSON ricevuto
    try:
        request = json.loads(data.decode().strip())
                
    except json.JSONDecodeError:
        logger.error("Errore nel JSON ricevuto")
        logger.error(data)

    cmd = request.get("cmd")

    if cmd == "get":
        # Esegui passo di simulazione
        payload = sim.step()
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


    elif cmd == 'done':
        # alla fine di ogni episodio aggiorna i valori di altezza d'onda e periodo
        new_sea_state = request.get("new_sea_state")
        sim.update_sea_state(new_sea_state)
        #logger.info(f"New sea_state {new_sea_state}...")

    else:
        response = {"error": "Comando non riconosciuto"}
        logger.warning(cmd)
        conn.sendall((json.dumps(response) + "\n").encode())

def close_simulation(conn, sim, elapsed_time):
    
    # Show the results if "show_results" is True and save them if "save_mode" is True
    sim.plot()

    tot_energy_absorbed = None
    
    if sim.get_sim_mode() == 'test':
        tot_energy_absorbed = sim.get_total_energy_absorbed()
        console.print(Panel(f"[bold green]Total energy absorbed: {round(tot_energy_absorbed,3)} MJ[/bold green]", title="[bold]Simulation Results[/bold]", expand=False))

    logger.info(
        f"Close simulation...\n"
        f"Elapsed real time : {elapsed_time} s\n"
    )

    connection_handler(conn, sim)
    
    return tot_energy_absorbed

def connection_handler(conn, sim):
    send_close_message(conn, sim.get_total_energy_absorbed())
    time.sleep(1)
    # Clear all the files if save_mode is False
    if not sim.get_save_mode():
        sim.clear()
        logger.info('Clear all the files')
    wait_closeack_message(conn)

def send_close_message(conn, energy_absorbed):
    try:
        close_message = json.dumps({"cmd": "close", "energy_abs": energy_absorbed}).encode()
        conn.sendall(close_message)
        return True
            
    except Exception as e:
        logger.error("Errore durante l'invio del messaggio di chiusura:", e)
        return False

def wait_closeack_message(conn):
    try:
        data = conn.recv(1024)
        if not data:
            logger.error("Nessun ack di chiusura ricevuto.")
            return False

        request = json.loads(data.decode().strip())
        cmd = request.get("cmd")

        if cmd == "ack-close":
            #print("Close ack receive by the client...")
            time.sleep(1)  # Attendi un attimo prima di rispondere
            #conn.sendall(b"Server close.\n")
            return True
        else:
            logger.error(f"Comando sconosciuto ricevuto: {cmd}")
            return False

    except json.JSONDecodeError:
        logger.error("Errore nel parsing del JSON ricevuto.")
        return False
    except Exception as e:
        logger.error(f"Errore durante la ricezione del messaggio di chiusura: {e}")
        return False
    

def send_warmup_values(sim, conn):
    try:
        warmup_values = sim.get_warmup_values()
        # print(f'Max heave :{warmup_values[0]} m')
        # print(f'Max velocity :{warmup_values[1]} m/s')
        conn.sendall((json.dumps(warmup_values) + "\n").encode())
        
        #print('Send warmup values to controller...\n')
        return True

    except Exception as e:
        logger.error("Errore durante l'invio del messaggio di chiusura:", e)
        return False
    

def read_config_file(file = "./utils/config.json"):
    config = None
    with open(file, "r") as f:
        config = json.load(f)

    return config

def write_config_file(data, file = "./utils/config.json"):
    with open(file, "w") as f:
        json.dump(data, f, indent=2)





def start_batch_simulation_rl(conn, n_batch, train_mode):
        
    logger.critical(f"Starting {n_batch} simulations in background mode...")
    total_energy_v = []

    for i in range (1, n_batch+1):
        energy_abs = start_single_simulation_rl(conn, train_mode)
        total_energy_v.append(energy_abs)
            
        config = read_config_file()
        config["sim_name"] = str(i+1) if i < n_batch else ""
        write_config_file(config)
        logger.critical(f"\nTerminated Simulation{i}...\n")
        
    mean_total_energy = np.mean(total_energy_v)
    logger.info(f"Mean Absorbed energy in batch test simulation is : {round(mean_total_energy,4)} MJ")
        
    return mean_total_energy


def start_single_simulation_rl(conn, train_mode):
    config = read_config_file()
    sim_train, sim_test = init_simulation(config)
    period_train, Hw_train, period_test, Hw_test = init_SS(sim_train, sim_test)
    sim_name = config['sim_name']
        
    if train_mode :
        if not config['mixed_sea_state']:
            logger.info(
                    f"Training Simulation{sim_name} started with these parameters:\n"
                    f"Period       : {period_train} s\n"
                    f"Wave height  : {Hw_train} m\n"
                    f"Wave mode    : {'regular' if config['regular'] else 'irregular'}\n"
                    f"Control mode : {config['control_mode']}\n"
                    f"Control d_t  : {config['d_t']}\n"
                    f"C*           : {config['init_C_star']}\n"
            )
        else:
            logger.info(                    
                    f"Training Simulation{sim_name} started with mixed sea state mode:\n"
                    f"Wave mode    : {'regular' if config['regular'] else 'irregular'}\n"
                    f"Control mode : {config['control_mode']}\n"
                    f"Control d_t  : {config['d_t']}\n"
                    f"C*           : {config['init_C_star']}\n"
            )               
        simulation_handler(conn, sim_train, 'rl')
        logger.info("Training Simulation finished...\n")


    logger.info(
            f"Testing Simulation{sim_name} started with these parameters:\n"
            f"Period       : {period_test} s\n"
            f"Wave height  : {Hw_test} m\n"
            f"Wave mode    : {'regular' if config['regular'] else 'irregular'}\n"
            f"Control mode : {config['control_mode']}\n"
            f"Control d_t  : {config['d_t']}\n"
            f"C*           : {config['init_C_star']}\n"
        )     
    energy_abs = simulation_handler(conn, sim_test, 'rl')
    logger.info("Testing Simulation finished...\n")
    
    return energy_abs  



def start_simulation_rl(conn, n_batch, train_mode, config):
    
    if n_batch > 1:
        energy_abs = start_batch_simulation_rl(conn, n_batch, train_mode)

    else:
        energy_abs = start_single_simulation_rl(conn, train_mode)

    entry = []
    entry.append({
        "control_type" : "rl_control",
        "test_time" : config['sim_time_test'],
        "fine_tuned_model" : config['retrain'],
        "regular" : config['regular'],
        "sea_state" : config['init_SS_test'],
        "C_star" : config['init_C_star'],
        "G_star" : 'variable',
        "energy_abs" : energy_abs
    })
    
    if config['regular']:
        path = os.path.join(config['results_dir'], "final/data/energy_results_regular_waves.csv")
    
    else:
        path = os.path.join(config['results_dir'], "final/data/energy_results_irregular_waves.csv")
    #save_energy_tabular_data(entry, path)

def start_simulation_baseline(conn, config):
    config = read_config_file()
    _, sim_test = init_simulation(config)
    T_zero = sim_test.get_period_zero()
    config['period_zero'] = T_zero
    write_config_file(config)
    _, _, period_test, Hw_test = init_SS(None, sim_test)
    logger.info(
        f"Testing Simulation with threshold control started with these parameters:\n"
            f"Period       : {period_test} s\n"
            f"Wave height  : {Hw_test} m\n"
            f"Wave mode    : {'regular' if config['regular'] else 'irregular'}\n"
            f"Control mode : {config['control_mode']}\n"
            f"Control d_t  : {config['d_t']}\n"
            f"C*           : {config['init_C_star']}\n"
        ) 
    energy_abs = simulation_handler(conn, sim_test, 'baseline')

    entry = []
    entry.append({
        "control_type" : "threshold_control",
        "test_time" : config['sim_time_test'],
        "fine_tuned_model" : False,
        "regular" : config['regular'],
        "sea_state" : config['init_SS_test'],
        "C_star" : config['init_C_star'],
        "G_star" : str(config['init_G_star']),
        "energy_abs" : energy_abs
    })
    
    if config['regular']:
        path = os.path.join(config['results_dir'], "final/data/energy_results_regular_waves.csv")
    
    else:
        path = os.path.join(config['results_dir'], "final/data/energy_results_irregular_waves.csv")
    #save_energy_tabular_data(entry, path)


def save_energy_tabular_data(entry, path):
    df_energy = pd.DataFrame(entry)
    header = not os.path.exists(path)
    df_energy.to_csv(path, mode='a', header= header, index=False)