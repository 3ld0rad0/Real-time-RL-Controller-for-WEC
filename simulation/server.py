import socket
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from utils.server_utilities import start_simulation_rl, read_config_file, write_config_file, start_simulation_baseline
from utils.test_configs import *
from rich.logging import RichHandler
import logging

# Logger setup
logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
    datefmt="[%X]",
    handlers=[RichHandler(rich_tracebacks=True)]
)

logger = logging.getLogger(__name__)

# C_STAR = 0.5
# SEA_STATE = 5
# set_config_rl_irregular(C_star = C_STAR, sea_state = SEA_STATE)
# set_config_baseline_irregular(C_star = C_STAR, sea_state = SEA_STATE)
# set_config_rlft_irregular(C_star = C_STAR, sea_state = SEA_STATE)

config = read_config_file()

HOST = config['host']  # Standard loopback interface address (localhost)
PORT = config['port']  # Port to listen on (non-privileged ports are > 1023)
TRAIN = config['train_model']
N_BATCH = config['batch_size']
RL_CONTROL = config['rl_control']

sim_name = "1" if N_BATCH > 1 else ""
config["sim_name"] = sim_name

write_config_file(config)



with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
    logger.info('Waiting for controller connession...')
    s.bind((HOST, PORT))
    s.listen(1)
    s.settimeout(15)
    
    try:
        conn, addr = s.accept()
    except socket.timeout:
        logger.error('Timeout reached... closing the server')
        exit(1)
    
    #conn.settimeout(10)
    with conn:
        logger.info(f"Connected by {addr}\n")
        
        if RL_CONTROL:
            start_simulation_rl(conn, n_batch = N_BATCH, train_mode = TRAIN, config = config)

        else:
            start_simulation_baseline(conn, config = config)

logger.info('Close Server.')
    