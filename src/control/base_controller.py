import logging
from abc import ABC, abstractmethod
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from src.network.client import connection_handler

logger = logging.getLogger(__name__)

class BaseController(ABC):
    """
    Abstract Base Class unificata per la creazione di controllori custom (sia matematici che RL).
    Gestisce automaticamente la comunicazione socket e il flusso (setup -> train -> test).
    """
    
    def __init__(self):
        pass

    @abstractmethod
    def setup(self, config):
        """
        Inizializza i parametri del controllore leggendoli dalla configurazione.
        Viene eseguito una volta sola all'avvio.
        """
        pass

    def train(self, s, config):
        """
        Da sovrascrivere per gli algoritmi che necessitano di addestramento (es. RL).
        I controllori rule-based classici ignoreranno questa fase.
        """
        pass

    @abstractmethod
    def act(self, state, time):
        """
        Calcola l'azione in base allo stato attuale e al tempo.
        Deve ritornare una tupla: (control_u, control_G_star)
        """
        pass

    def test(self, s, config):
        """
        Ciclo principale di simulazione. 
        Può essere sovrascritto se l'agente usa ambienti complessi (es. WECEnv in SB3).
        Altrimenti, utilizza il ciclo while standard di BaseController chiamando act().
        """
        t_final = config.get('sim_time_test', 0)
        current_t = 0
        
        logger.debug('Starting test simulation (Standard Loop)...')
        
        while current_t < t_final:
            state, t = self.get_observation(s)
            current_t = t
            
            if current_t == t_final:
                break
            
            control = self.act(state, current_t)
            self.send_action(s, control)
        
        logger.info("Test simulation completed...")

    def get_observation(self, s):
        """
        Metodo interno. Richiede lo stato attuale al server.
        """
        s.send_msg({"cmd": "get"})
        state_raw = s.recv_msg()
        state = (
            state_raw['position'], 
            state_raw['velocity'], 
            state_raw['excitation_force'], 
            state_raw['f_pto_damp'], 
            state_raw['G_star']
        )
        return state, state_raw['time']

    def send_action(self, s, control):
        """
        Metodo interno. Invia l'azione calcolata al server.
        """
        control_u, control_G_star = control
        payload_control = {
            "cmd": "control",
            "params": {
                "u": control_u,
                "G_star": control_G_star
            }
        }
        s.send_msg(payload_control)

    def start(self, s, config):
        """
        Main entry point per UniversalClient. 
        Esegue il setup e gestisce il batching per train e test.
        """
        self.setup(config)
        
        n_batch = config.get('batch_size', 1)
        train_mode = config.get('train_model', False)
        
        for i in range(n_batch):
            if train_mode:
                self.train(s, config)
            
            self.test(s, config)
        
        # Gestisci la chiusura pulita a fine simulazione
        connection_handler(s)
