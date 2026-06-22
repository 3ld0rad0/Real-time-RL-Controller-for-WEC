import socket
import json
import logging
import os
import sys

# Ensure proper path for imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from utils.controller_utilities import read_config_file
from utils.connection import JSONSocketWrapper
from rich.logging import RichHandler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
    datefmt="[%X]",
    handlers=[RichHandler(rich_tracebacks=True)]
)

logger = logging.getLogger(__name__)

class UniversalClient:
    """
    Universal Client to handle socket connection and configuration.
    It completely decouples the network boilerplate from the algorithm logic.
    """
    def __init__(self, config_file="./utils/config.json"):
        self.config = read_config_file(config_file)
        self.host = self.config.get('host', '127.0.0.1')
        self.port = self.config.get('port', 65432)

    def run(self, algorithm_func):
        """
        Connect to the server and pass the wrapped socket and config to the algorithm.
        
        :param algorithm_func: A callable that accepts (wrapped_socket, config)
        """
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.connect((self.host, self.port))
                logger.info(f"Connected to server at {self.host}:{self.port}...")
                
                wrapped_s = JSONSocketWrapper(s)

                # Execute the specific algorithm strategy
                algorithm_func(wrapped_s, self.config)

            except json.JSONDecodeError:
                logger.error("Decode error in the response by the server...")

            except Exception as e:
                logger.error(f"Error during execution: {e}")
                logger.error("Connection closed by the server...")

        logger.info("Close Client.")
