import numpy as np
import json
import sys
import os
import socket
import time
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from src.simulation.Oscillator import Oscillator
from src.simulation.Simulation import Simulation
import logging
from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, TextColumn, BarColumn, TaskProgressColumn, TimeElapsedColumn, TimeRemainingColumn

logger = logging.getLogger(__name__)
console = Console(force_terminal=True, force_interactive=True)

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
    
    oscillator_train = Oscillator(C, C_STAR, K, G_STAR, regular, sim_time_train, control_mode, d_t, nSS_train, seed_spectrum=17)
    oscillator_test = Oscillator(C, C_STAR, K, G_STAR, regular, sim_time_test, control_mode, d_t, nSS_test, seed_spectrum=123)

    sim_train = Simulation(oscillator_train, save_mode, 'train', control_alg, sim_name, sim_dir, show_results, mixed_sea_state)
    sim_test = Simulation(oscillator_test, save_mode, 'test', control_alg, sim_name, sim_dir, show_results, mixed_sea_state)

    init_values_train = (oscillator_train.get_period(), oscillator_train.get_wave_height())
    init_values_test = (oscillator_test.get_period(), oscillator_test.get_wave_height())
    sim_train.load_warmup_values(init_values_train)
    sim_test.load_warmup_values(init_values_test)

    config["n_steps"] = int((1/d_t) * sim_time_train)
    config["sim_name"] = sim_name
    write_config_file(config)
    
    return sim_train, sim_test


def simulation_handler(conn, sim, control):
    start_t = time.time()
    start_simulation(conn, sim, control)
    end_t = time.time()
    elapsed_time = np.round(end_t - start_t, 2)
    energy = close_simulation(conn, sim, elapsed_time)
    return energy

def start_simulation(conn, sim, control):
    if control == 'rl':
        send_warmup_values(sim, conn)
    
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
        console=console,
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
    request = conn.recv_msg()
    if request is None:
        logger.error('No data received or decode error... close connection')
        raise Exception

    cmd = request.get("cmd")

    if cmd == "get":
        payload = sim.step()
        conn.send_msg(payload)

    elif cmd == "control":
        params = request.get("params", {})
        if sim.get_control_mode() == 'linear':
            new_C = np.float64(params.get("C"))
            new_K = np.float64(params.get("K"))
            sim.send_control_linear((new_C, new_K))
        else:
            new_u = np.float64(params.get("u"))
            new_G_star = np.float64(params.get("G_star"))
            sim.send_control_latching((new_u, new_G_star))

    elif cmd == 'done':
        new_sea_state = request.get("new_sea_state")
        sim.update_sea_state(new_sea_state)

    else:
        response = {"error": "Comando non riconosciuto"}
        logger.warning(cmd)
        conn.send_msg(response)

def close_simulation(conn, sim, elapsed_time):
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
    if not sim.get_save_mode():
        sim.clear()
        logger.info('Clear all the files')
    wait_closeack_message(conn)

def send_close_message(conn, energy_absorbed):
    try:
        close_message = {"cmd": "close", "energy_abs": energy_absorbed}
        conn.send_msg(close_message)
        return True
    except Exception as e:
        logger.error("Errore durante l'invio del messaggio di chiusura:", e)
        return False

def wait_closeack_message(conn):
    try:
        request = conn.recv_msg()
        if not request:
            logger.error("Nessun ack di chiusura ricevuto.")
            return False

        cmd = request.get("cmd")
        if cmd == "ack-close":
            return True
        else:
            logger.error(f"Comando sconosciuto ricevuto: {cmd}")
            return False
    except Exception as e:
        logger.error(f"Errore durante la ricezione del messaggio di chiusura: {e}")
        return False
    
def send_warmup_values(sim, conn):
    try:
        warmup_values = sim.get_warmup_values()
        conn.send_msg(warmup_values)
        return True
    except Exception as e:
        logger.error("Errore durante l'invio dei warmup values:", e)
        return False
    
def read_config_file(file="./src/config/config.json"):
    import time
    for _ in range(5):
        try:
            with open(file, "r") as f:
                return json.load(f)
        except json.JSONDecodeError:
            time.sleep(0.1)
    with open(file, "r") as f:
        return json.load(f)

def write_config_file(data, file="./src/config/config.json"):
    with open(file, "w") as f:
        json.dump(data, f, indent=2)


def _log_sim_start(sim_name, mode, config, period, hw):
    if config['mixed_sea_state'] and mode.lower() == 'training':
        logger.info(                    
            f"{mode} Simulation{sim_name} started with mixed sea state mode:\n"
            f"Wave mode    : {'regular' if config['regular'] else 'irregular'}\n"
            f"Control mode : {config['control_mode']}\n"
            f"Control d_t  : {config['d_t']}\n"
            f"C*           : {config['init_C_star']}\n"
        )
    else:
        logger.info(
            f"{mode} Simulation{sim_name} started with these parameters:\n"
            f"Period       : {period} s\n"
            f"Wave height  : {hw} m\n"
            f"Wave mode    : {'regular' if config['regular'] else 'irregular'}\n"
            f"Control mode : {config['control_mode']}\n"
            f"Control d_t  : {config['d_t']}\n"
            f"C*           : {config['init_C_star']}\n"
        )

def _run_single_episode(conn, train_mode):
    config = read_config_file()
    sim_train, sim_test = init_simulation(config)
    sim_name = config['sim_name']
    
    if train_mode:
        _log_sim_start(sim_name, 'Training', config, 
                       sim_train.get_oscillator().get_period(), 
                       sim_train.get_oscillator().get_wave_height())
        simulation_handler(conn, sim_train, 'rl')
        logger.info("Training Simulation finished...\n")

    _log_sim_start(sim_name, 'Testing', config, 
                   sim_test.get_oscillator().get_period(), 
                   sim_test.get_oscillator().get_wave_height())
    energy_abs = simulation_handler(conn, sim_test, 'rl')
    logger.info("Testing Simulation finished...\n")
    return energy_abs

def start_simulation_rl(conn, n_batch, train_mode, config):
    if n_batch > 1:
        logger.critical(f"Starting {n_batch} simulations in background mode...")
        total_energy_v = []
        for i in range(1, n_batch + 1):
            energy_abs = _run_single_episode(conn, train_mode)
            total_energy_v.append(energy_abs)
            
            cfg = read_config_file()
            cfg["sim_name"] = str(i+1) if i < n_batch else ""
            write_config_file(cfg)
            logger.critical(f"\nTerminated Simulation{i}...\n")
            
        mean_total_energy = np.mean(total_energy_v)
        logger.info(f"Mean Absorbed energy in batch test simulation is : {round(mean_total_energy,4)} MJ")
    else:
        _run_single_episode(conn, train_mode)

def start_simulation_baseline(conn, config):
    config = read_config_file()
    _, sim_test = init_simulation(config)
    
    config['period_zero'] = sim_test.get_period_zero()
    write_config_file(config)
    
    _log_sim_start("", 'Testing (Baseline)', config, 
                   sim_test.get_oscillator().get_period(), 
                   sim_test.get_oscillator().get_wave_height())
    simulation_handler(conn, sim_test, 'baseline')