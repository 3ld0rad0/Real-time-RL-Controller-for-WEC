import socket
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from utils.server_utilities import start_simulation_train_test, read_config_file, write_config_file
import logging

# Logger setup
logging.basicConfig(
    level=logging.INFO,  # Cambia a DEBUG se vuoi più dettagli
    #format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

config = read_config_file()

HOST = config['host']  # Standard loopback interface address (localhost)
PORT = config['port']  # Port to listen on (non-privileged ports are > 1023)
TRAIN = config['train_model']
N_BATCH = config['batch_size']

sim_name = "1" if N_BATCH > 1 else ""
#show_results = False if N_BATCH > 1 else True
config["sim_name"] = sim_name
#config["show_results"] = show_results

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

        start_simulation_train_test(conn, n_batch = N_BATCH, train_mode = TRAIN)


logger.info('Close Server.')
    