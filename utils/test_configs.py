import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from utils.server_utilities import read_config_file, write_config_file


def set_config_rl_irregular(C_star, sea_state, batch_size = 1):
    config = read_config_file()
    config['rl_control'] = True
    config['regular'] = False
    config['save_mode'] = True
    config['train_model'] = False
    config['retrain'] = False
    config['init_C_star'] = C_star
    config['sim_time_test'] = 900
    config['init_SS_test'] = sea_state
    config['batch_size'] = batch_size
    config['path_model'] = "./models/irregular/sea_state_mixed/simulation_0.01/ppomodel_sim_latching_16.0h_05s_irregular"
    write_config_file(config)


def set_config_rlft_irregular(C_star, sea_state, batch_size = 1):
    config = read_config_file()
    config['rl_control'] = True
    config['regular'] = False
    config['save_mode'] = True
    config['train_model'] = False
    config['retrain'] = True
    config['init_C_star'] = C_star
    config['sim_time_test'] = 900
    config['init_SS_test'] = sea_state
    period_t = config['period_table']
    wh_t = config['wave_height_table']
    period = period_t[sea_state]
    wh = wh_t[sea_state]
    config['batch_size'] = batch_size
    config['path_model'] = f"./models/irregular/sea_state_{wh}_{period}/simulation_0.01/ppomodel_sim_latching_fine_tuning_4.0h_05s_{wh}_{period}_irregular"
    write_config_file(config)

def set_config_baseline_irregular(C_star, sea_state):
    config = read_config_file()
    config['rl_control'] = False
    config['regular'] = False
    config['save_mode'] = True
    config['train_model'] = False
    config['retrain'] = False
    config['init_C_star'] = C_star
    config['sim_time_test'] = 900
    config['init_SS_test'] = sea_state
    config['batch_size'] = 1
    config['path_model'] = ''
    write_config_file(config)