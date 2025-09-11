import socket
import json
import os, sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from utils.controller_utilities import start_threshold_control, read_config_file
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

HOST = config['host']
PORT = config['port']
N_BATCH = config['batch_size']
#THRESHOLD = compute_threshold(config)


with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
    try:
        s.connect((HOST, PORT))
        logger.info("Connect to server...")

        start_threshold_control(s, config)

    except json.JSONDecodeError:
        logger.error("Decode error in the response by the server...")

    except Exception as e:
        logger.error(e)
        logger.error("Connection close by the server...")

logger.info("Close Client.")
