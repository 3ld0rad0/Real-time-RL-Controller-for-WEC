"""DEFINE SIMULATION CLASS TO MANAGE THE SIMULATION PROCESS OF THE WEC SYSTEM"""


import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import matplotlib.pyplot as plt
import src.utils.mpl_utils as mut
from src.utils.mpl_utils import linecolors
mut.config_plots()


from src.utils.plot import *
import numpy as np
from collections import deque
import pandas as pd
import json
import logging

logger = logging.getLogger(__name__)

class Simulation:
    def __init__(self, oscillator, save_mode, sim_mode, sim_alg, sim_name, sim_dir, show_results, mixed_sea_state):
        
        self._oscillator = oscillator
        self._sim_time = self._oscillator.get_t_final()
        self._d_t = self._oscillator.get_d_t()
        self._save_mode = save_mode
        self._show_results = show_results
        self._control_mode = self._oscillator.get_control_mode()
        self._control_alg = sim_alg
        self._sim_mode = sim_mode
        self._sim_name = sim_name
        self._mixed_sea_state = mixed_sea_state

        # position - speed - f_pto_damp - f_pto_stif - u_latching - G_star
        self._current_state = (0.0, 0.0, 0.0, 0.0, 0.0, 0.0)
        self._current_t = 0.0
        self._current_ss = self._oscillator.get_sea_state()

        self._wave_mode = 'regular' if self._oscillator.get_wmode() else 'irregular'

        self._period = self._oscillator.get_period()
        self._observation_period = 60.0
        self._eval_len = self._oscillator.get_eval_len()
        # numero di elementi del vettore buff_hist che rappresentano un periodo d'onda
        self._buff_len = self._observation_period * (1 / self._d_t)
        
        # numero di periodi da osservare
        self._attention_win = 5

        self._attention_len = self._attention_win * int(self._buff_len)

        # buffer che mantiene solo gli elementi più recenti
        self._buff_hist = deque(maxlen=self._attention_len)
        
        self._set_sim_path(sim_dir)

        # Contatore che tiene traccia di quanti salvataggi sono stati effettuati
        self._cycle_counter = 0

        self._max_cycle = self._sim_time // (self._observation_period * self._attention_win)

        self._supp_buff = []
        self._energy_buff = []
        self._total_energy_absorbed = 0.0
    
    def _set_sim_path(self, sim_dir):
        self._sim_dir = sim_dir
        
        time_str = f"{self._sim_time / 3600}h" if self._sim_mode == 'train' else f"{self._sim_time}s"
        dt_str = f"{self._d_t}".replace('.', '') + "s"
        
        # Determine suffix/prefix for custom run name to avoid flat concatenation
        sim_suffix = ""
        if self._sim_name:
            if self._sim_name.isdigit():
                sim_suffix = self._sim_name
            else:
                sim_suffix = f"_run_{self._sim_name}"
        
        if self._mixed_sea_state:
            self._file_name = f'simulation_mixed{sim_suffix}_{self._control_mode}_{self._control_alg}_{time_str}_{dt_str}_{self._wave_mode}'
            self._base_data_name = f'{sim_dir}/{self._sim_mode}/data/{self._wave_mode}/sea_state_mixed'
            self._base_plot_name = f'{sim_dir}/{self._sim_mode}/plot/{self._wave_mode}/sea_state_mixed'
        else:
            self._file_name = f'simulation{sim_suffix}_{self._control_mode}_{self._control_alg}_{time_str}_{dt_str}_{self._oscillator.get_wave_height()}_{self._oscillator.get_period()}_{self._wave_mode}'
            self._base_data_name = f'{sim_dir}/{self._sim_mode}/data/{self._wave_mode}/sea_state_{self._oscillator.get_wave_height()}_{self._oscillator.get_period()}'
            self._base_plot_name = f'{sim_dir}/{self._sim_mode}/plot/{self._wave_mode}/sea_state_{self._oscillator.get_wave_height()}_{self._oscillator.get_period()}'
        
        self._results_path       = f'{self._base_data_name}/{self._file_name}.csv'
        self._energy_path        = f'{self._base_data_name}/{self._file_name}_energy_absorbed.csv'
        self._reward_path        = f'{self._base_data_name}/{self._file_name}_reward.csv'
        
        self._plot_path          = f'{self._base_plot_name}/{self._file_name}.png'
        self._plot_energy_path   = f'{self._base_plot_name}/{self._file_name}_energy_absorbed.png'
        self._plot_reward_path   = f'{self._base_plot_name}/{self._file_name}_reward.png'

        for path in [self._results_path, self._energy_path, self._reward_path, self._plot_path, self._plot_energy_path, self._plot_reward_path]:
            if os.path.exists(path):
                os.remove(path)

        for directory in [self._base_data_name, self._base_plot_name]:
            if not os.path.exists(directory):
                os.makedirs(directory)

    def get_save_mode(self):
        return self._save_mode

    def get_state(self):
        return self._current_state

    def get_warmup_values(self):
        return {
            "x_warmup": self.x_max,
            "v_warmup": self.v_max,
            "fet_warmup": self.fet_max,
            "opt_damping": self._oscillator.get_opt_damping_pto(),
            "opt_stifness": self._oscillator.get_opt_stifness_pto(),
            "period": self._oscillator.get_period(),
            "hw": self._oscillator.get_wave_height()
        }

    def load_warmup_values(self, init_values, file_path='./src/config/warmup.json'):
        period, Hw = init_values

        with open(file_path, "r") as f:
            warmup_values = json.load(f)

        mode = self._oscillator.get_wmode()
        w_mode = 'regular' if mode else 'irregular'
        w_params = f"T_{period}_Hw_{Hw}"
        w_v = warmup_values[w_mode][w_params]

        self.x_max = np.float64(w_v["x_max"])
        self.v_max = np.float64(w_v["v_max"])
        self.fet_max = np.float64(w_v["fet_max"])

        self.reset()

    def get_oscillator(self):
        return self._oscillator

    def get_sim_time(self):
        return self._sim_time

    def get_sim_mode(self):
        return self._sim_mode

    def get_current_time(self):
        return self._current_t

    def get_control_mode(self):
        return self._control_mode

    def _write_buffer_to_file(self, buff, r):
        """Scrive il contenuto del buffer su file"""
        if not buff:
            return
            
        # Estrai i dati dal buffer in modo vettorizzato
        t_list, x_list, v_list, fet_list, wave_list, damp_list, stif_list, pow_inst_list, u_list, g_list, ss_list = zip(*buff)

        data_to_write = {
            "time": np.concatenate(t_list),
            "position": np.concatenate(x_list),
            "velocity": np.concatenate(v_list),
            "excitation_force": np.concatenate(fet_list),
            "wave_t": np.concatenate(wave_list),
            "damping_fpto": np.concatenate(damp_list),
            "stifness_fpto": np.concatenate(stif_list),
            "u_latching": np.concatenate(u_list),
            "G_star": np.concatenate(g_list),
            "power_inst": np.concatenate(pow_inst_list),
            "sea_state": np.concatenate(ss_list)
        }
        
        mean_energy = []
        
        # CONTROL ENERGY WAVE AND ETA
        #########################################
        energy_abs = sum(x[1] for x in self._energy_buff) ## energia catturata in una finestra di osservazione [J]
        energy_wave = self._oscillator.get_wave_energy() ## energia dell'onda in un determinato sea state
        
        if r > 0:
            eta = energy_abs / (energy_wave * (r / self._period))
        else:
            eta = energy_abs / (energy_wave * self._attention_win)
        
        mean_energy.append({
            "time": self._current_t,
            "energy_abs": energy_abs, ## Energy absorbed
            "eta": eta, ## Capture Width Ratio
            "period_sea_state": self._current_ss
        })
        ##########################################
        self._energy_buff.clear()
        
        # Scrivi su file
        df = pd.DataFrame(data_to_write)
        header = not os.path.exists(self._results_path)
        df.to_csv(self._results_path, mode='a', header=header, index=False)

        df_energy = pd.DataFrame(mean_energy)
        header = not os.path.exists(self._energy_path)
        df_energy.to_csv(self._energy_path, mode='a', header=header, index=False)

    def send_control_linear(self, control):
        new_C = control[0]
        new_K = control[1]
        if new_C is not None and new_K is not None:
            self._oscillator.set_fpto(new_C, new_K)

    def send_control_latching(self, control):
        new_u, new_G_star = control
        if new_u is not None:
            self._oscillator.set_latching(new_u)
            self._oscillator.set_G_star(new_G_star)
    
    def _calculate_total_energy_absorbed(self):
        df = pd.read_csv(self._energy_path)
        energy = df['energy_abs']
        self._total_energy_absorbed = np.sum(energy) * 10 ** -6

    def get_total_energy_absorbed(self):
        return self._total_energy_absorbed
    
    def plot(self):
        for f in [self._results_path, self._energy_path]:
            if not os.path.exists(f):
                logger.error(f"Nessun file {f} trovato...")
                return
        
        df = pd.read_csv(self._results_path)
        df_energy = pd.read_csv(self._energy_path)
        df_plot_last = df.tail(2500)
        
        if self._sim_mode == 'train':
            if self._control_mode == 'linear':
                plot_linear(df, df_energy, df_plot_last, self._save_mode, self._plot_path)
            else:
                plot_latching(df, df_energy, df_plot_last, self._save_mode, self._plot_path)
            
            plot_energy(self._save_mode, self._energy_path, self._plot_energy_path)
            plot_reward(self._save_mode, self._reward_path, self._plot_reward_path)
        
        elif self._sim_mode == 'test':
            plot_test(df_plot_last, self._save_mode, self._plot_path)
            self._calculate_total_energy_absorbed()

        plt.close()

    # pulisce i file csv se save_mode = 0
    def clear(self):
        for path in [self._results_path, self._energy_path, self._reward_path]:
            if os.path.exists(path):
                os.remove(path)

    def reset(self):
        # position - speed - f_pto_damp - f_pto_stif - u_latching - G_star
        self._current_state = (0.0, 0.0, 0.0, 0.0, 0.0, 0.0)
        self._current_t = 0.0
        self._buff_hist.clear()
        self._cycle_counter = 0
        self._supp_buff = []
        self._energy_buff = []
        self._total_energy_absorbed = 0.0
        
        for path in [self._results_path, self._energy_path, self._plot_path, self._plot_energy_path]:
            if os.path.exists(path):
                os.remove(path)
        
    def update_sea_state(self, sea_state):
        self._oscillator.update_sea_state(sea_state)
        # aggiorna il sea state e il periodo
        self._current_ss = sea_state
        table_period = self._oscillator.get_table_period()
        self._period = table_period[self._current_ss]

    def get_period_zero(self):
        return self._oscillator.get_period_zero()
        
    def step(self):
        if self._current_t > 0.0:
            t_span = (self._current_t + (self._d_t / self._eval_len), self._current_t + self._d_t)
        else:
            t_span = (self._current_t, self._current_t + self._d_t)
        
        init_conditions = (self.get_state()[0], self.get_state()[1])
        self._oscillator.solve(t_span=t_span, initial_conditions=init_conditions)

        x = self._oscillator.get_position()
        v = self._oscillator.get_speed()
        fet = self._oscillator.get_fet()
        t = self._oscillator.get_timevector()
        wave_t = self._oscillator.get_wavet()
        period = self._oscillator.get_period()
        Hw = self._oscillator.get_wave_height()
        w_mode = self._oscillator.get_wmode()

        d_fpto = self._oscillator.get_fpto_damping()
        s_fpto = self._oscillator.get_fpto_stifness()

        sea_state = self._oscillator.get_sea_state()
        sea_state_array = np.full(shape=self._eval_len, fill_value=sea_state)

        damping_fpto_array = np.full(shape=self._eval_len, fill_value=self._oscillator.get_fpto_damping())
        stifness_fpto_array = np.full(shape=self._eval_len, fill_value=self._oscillator.get_fpto_stifness())
        
        pow_inst = self._oscillator.get_pow_inst()
        energy = self._oscillator.get_energy()
        self._energy_buff.append((t[-1], energy))
        
        if self._control_mode == 'linear':
            # valore di default quando non viene utilizzato il latching control
            self._oscillator.set_latching(u=-1.0)
            self._oscillator.set_G_star(g_star=-1.0)

        u_latching = self._oscillator.get_latching()
        u_latching_array = np.full(shape=self._eval_len, fill_value=u_latching)
        g_star = self._oscillator.get_G_star()
        g_star_array = np.full(shape=self._eval_len, fill_value=g_star)

        self._current_state = (x[-1], v[-1], d_fpto, s_fpto, u_latching, g_star)
        self._current_t = round(t[-1], 2)

        self._buff_hist.append((t, x, v, fet, wave_t, damping_fpto_array, stifness_fpto_array, pow_inst, u_latching_array, g_star_array, sea_state_array))
        
        if self._cycle_counter >= self._max_cycle:
            self._supp_buff.append((t, x, v, fet, wave_t, damping_fpto_array, stifness_fpto_array, pow_inst, u_latching_array, g_star_array, sea_state_array))
            
            if self._current_t >= self._sim_time:
                r = self._sim_time % (self._period * self._attention_win)
                self._write_buffer_to_file(self._supp_buff, r)
        
        elif (self._current_t % (self._observation_period * self._attention_win)) == 0:
            r = 0
            self._write_buffer_to_file(self._buff_hist, r)
            self._cycle_counter += 1

        state = {
            'time': round(t[-1], 1),
            'position': round(x[-1], 3),
            'velocity': round(v[-1], 3),
            'excitation_force': round(fet[-1], 3),
            'f_pto_damp': d_fpto,
            'f_pto_stif': s_fpto,
            'u_latching': u_latching,
            'G_star': g_star,
            'period': period,
            'wave_height': Hw,
            'w_mode': w_mode
        }
        
        return state