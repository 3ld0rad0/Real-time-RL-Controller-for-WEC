import os, sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from agent.client import UniversalClient
from utils.controller_utilities import start_rl_control

if __name__ == '__main__':
    client = UniversalClient()
    client.run(start_rl_control)
