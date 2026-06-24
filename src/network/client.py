import socket
import json
import logging
import os
import sys

# Ensure proper path for imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.network.connection import JSONSocketWrapper
from rich.logging import RichHandler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
    datefmt="[%X]",
    handlers=[RichHandler(rich_tracebacks=True)]
)

logger = logging.getLogger(__name__)

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

def wait_close_message(socket):
    try:
        request = socket.recv_msg()
        if not request:
            logger.error("Nessun ack di chiusura ricevuto.")
            return False

        cmd = request.get("cmd")
        if cmd == "close":
            return True
        else:
            logger.error(f"Comando sconosciuto ricevuto: {cmd}")
            return False

    except Exception as e:
        logger.error(f"Errore durante la ricezione del messaggio di chiusura: {e}")
        return False

def send_closeack_message(socket):
    try:
        ack_message = {"cmd": "ack-close"}
        socket.send_msg(ack_message)
        return True
            
    except Exception as e:
        logger.error("Errore durante l'invio del messaggio di chiusura:", e)
        return False

def connection_handler(socket):
    wait_close_message(socket)
    send_closeack_message(socket)


class UniversalClient:
    """
    Universal Client to handle socket connection and configuration.
    It completely decouples the network boilerplate from the algorithm logic.
    """
    def __init__(self, config_file="./src/config/config.json"):
        self.config = read_config_file(config_file)
        self.host = self.config.get('host', '127.0.0.1')
        self.port = self.config.get('port', 65432)

    def run(self, algorithm_func):
        """
        Connect to the server and pass the wrapped socket and config to the algorithm.
        """
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.connect((self.host, self.port))
                logger.info(f"Connected to server at {self.host}:{self.port}...")
                
                wrapped_s = JSONSocketWrapper(s)

                # Execute the specific algorithm strategy
                algorithm_func(wrapped_s, self.config)

            except json.JSONDecodeError as e:
                import traceback
                traceback.print_exc()
                logger.error(f"Decode error in the response by the server... {e}")

            except Exception as e:
                logger.error(f"Error during execution: {e}")
                logger.error("Connection closed by the server...")

        logger.info("Close Client.")
