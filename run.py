import argparse
import json
import subprocess
import time
import sys
import os
from rich.console import Console
from rich.table import Table

console = Console()

CONFIG_PATH = os.path.join("src", "config", "config.json")

def load_config():
    with open(CONFIG_PATH, "r") as f:
        return json.load(f)

def save_config(config):
    with open(CONFIG_PATH, "w") as f:
        json.dump(config, f, indent=2)

def main():
    parser = argparse.ArgumentParser(description="WEC-RL Simulation Runner")
    
    parser.add_argument("--mode", type=str, choices=["train", "test"], default="test",
                        help="Scegli di addestrare un nuovo modello (train) o testarne uno (test).")
    parser.add_argument("--control", type=str, choices=["rl", "baseline"], default="rl",
                        help="Usa il Reinforcement Learning (rl) o la Baseline (baseline).")
    parser.add_argument("--type", type=str, choices=["latching", "linear"], default="latching",
                        help="Modalità di controllo: latching o linear.")
    parser.add_argument("--sea-state", type=int, choices=range(0, 9), default=5,
                        help="Stato del mare da simulare (0-8).")
    parser.add_argument("--mixed", action="store_true",
                        help="Abilita stati del mare misti durante la simulazione.")
    parser.add_argument("--regular", action="store_true",
                        help="Usa onde regolari (invece di quelle irregolari di default).")
    parser.add_argument("--sim-time", type=float, default=None,
                        help="Tempo di simulazione (ore per il train, secondi per il test).")
    parser.add_argument("--save", action="store_true",
                        help="Salva i risultati (csv, plot) a fine simulazione.")
    parser.add_argument("--retrain", action="store_true", help="Se vero, continua il training di un modello esistente.")
    parser.add_argument("--model-path", type=str, default="", help="Percorso del modello da testare o retrainare.")
    parser.add_argument("--batch-size", type=int, default=2048, help="Batch size per il PPO.")
    parser.add_argument("--entropy-coef", type=float, default=0.01, help="Entropy coefficient per il PPO.")
    
    args = parser.parse_args()

    # Forziamo il backend 'Agg' per matplotlib così da evitare crash in ambienti sprovvisti di librerie grafiche (es. Qt/X11).
    os.environ['MPLBACKEND'] = 'Agg'

    # Legge l'attuale configurazione
    if not os.path.exists(CONFIG_PATH):
        print(f"[!] Errore: {CONFIG_PATH} non trovato.")
        sys.exit(1)

    config = load_config()
    
    # Sovrascrive i parametri basandosi sugli argomenti passati
    config["train_model"] = (args.mode == "train")
    config["rl_control"] = (args.control == "rl")
    config["control_mode"] = args.type
    config["mixed_sea_state"] = args.mixed
    config["regular"] = args.regular
    config["show_results"] = False
    config["save_mode"] = args.save
    config["retrain"] = args.retrain
    config["batch_size"] = args.batch_size
    config["ent_coef"] = args.entropy_coef
    
    if args.model_path:
        if args.mode == "train" and args.retrain:
            config["retrain_path_model"] = args.model_path
        else:
            config["path_model"] = args.model_path
    
    if args.mode == "train":
        config["init_SS_train"] = args.sea_state
        if args.sim_time is not None:
            config["sim_time_train"] = args.sim_time
    else:
        config["init_SS_test"] = args.sea_state
        if args.sim_time is not None:
            config["sim_time_test"] = args.sim_time

    # Salva la configurazione aggiornata
    save_config(config)
    
    table = Table(title="Parametri della Simulazione", show_header=True, header_style="bold magenta")
    table.add_column("Parametro", style="cyan")
    table.add_column("Valore", style="green")
    table.add_row("Mode", args.mode)
    table.add_row("Control", args.control)
    table.add_row("Type", args.type)
    table.add_row("Sea State", str(args.sea_state))
    table.add_row("Mixed Sea State", str(args.mixed))
    table.add_row("Regular Waves", str(args.regular))
    table.add_row("Save Mode", str(args.save))
    if args.sim_time is not None:
        table.add_row("Sim Time", str(args.sim_time))
        
    console.print(table)

    # Determina quale script del client usare
    client_module = "src.control.rl_control" if args.control == "rl" else "src.control.th_control"

    # Avvia il Server
    console.print(f"[bold blue][*] Avvio del Server (src.network.server)...[/bold blue]")
    server_process = subprocess.Popen([sys.executable, "-m", "src.network.server"])
    
    # Attesa breve affinché il server apra il socket
    time.sleep(2)
    
    if server_process.poll() is not None:
        console.print("[bold red][!] Il server si è interrotto prematuramente.[/bold red]")
        sys.exit(1)

    # Avvia il Client
    console.print(f"[bold blue][*] Avvio del Client ({client_module})...[/bold blue]")
    client_process = subprocess.Popen([sys.executable, "-m", client_module])

    try:
        client_process.wait()
        server_process.wait(timeout=5)
    except KeyboardInterrupt:
        console.print("\n[bold red][!] Interruzione manuale ricevuta. Termino i processi...[/bold red]")
        client_process.terminate()
        server_process.terminate()
    except subprocess.TimeoutExpired:
        server_process.terminate()
        
    console.print("[bold green][*] Simulazione conclusa.[/bold green]")

if __name__ == "__main__":
    main()
