import numpy as np
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from src.network.client import UniversalClient
from src.control.base_controller import BaseController

class ThresholdController(BaseController):
    
    def setup(self, config):
        """
        Calcola la soglia e salva i parametri iniziali utili.
        """
        self.G_star = config['init_G_star']
        
        regular = config['regular']
        nSS = config['init_SS_test']
        period_table = config['period_table']
        hw_table = config['wave_height_table']
        T_zero = config['period_zero']
        T_e = period_table[nSS]
        H_s = hw_table[nSS]

        if regular:
            H = H_s / np.sqrt(2)
            T = T_e / 0.857
            self.th = (H / 2) * np.sin((np.pi / 2) * (1 - T_zero / T))
        else:
            self.th = (H_s / (2 * np.sqrt(2))) * np.sin((np.pi / 2) * (1 - T_zero / T_e))

    def act(self, state, time):
        """
        Logica di controllo Threshold:
        se la posizione supera la soglia, abilita il latching (u=1).
        Altrimenti disabilitalo (u=0).
        """
        position = state[0]
        
        if position > self.th:
            return (1, self.G_star)
        else:
            return (0, self.G_star)

if __name__ == '__main__':
    # 1. Istanzia la classe dell'algoritmo
    agent = ThresholdController()
    
    # 2. Avvia il client universale passandogli l'entry point (start)
    client = UniversalClient()
    client.run(agent.start)
