import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import matplotlib.pyplot as plt
import utils.mpl_utils as mut
from  utils.mpl_utils import linecolors
mut.config_plots()
from matplotlib_inline.backend_inline import set_matplotlib_formats
set_matplotlib_formats('svg')

from utils.plot import *
import numpy as np
from collections import deque
import pandas as pd
import json
import logging

logger = logging.getLogger(__name__)

class Simulation:
    def __init__(self, oscillator, save_mode, sim_mode, sim_name, sim_dir, show_results, mixed_sea_state):
        
        self.oscillator = oscillator
        self.sim_time = self.oscillator.get_t_final()
        self.d_t = self.oscillator.get_d_t()
        self.save_mode = save_mode
        self.show_results = show_results
        self.control_mode = self.oscillator.get_control_mode()
        self.sim_mode = sim_mode
        self.sim_name = sim_name
        self.mixed_sea_state = mixed_sea_state

        # position - speed - f_pto_damp - f_pto_stif - u_latching - G_star
        self.current_state = (0.0, 0.0, 0.0, 0.0, 0.0, 0.0)
        self.current_t = 0.0
        self.current_ss = self.oscillator.get_sea_state()

        self.wave_mode = 'regular' if self.oscillator.get_wmode() else 'irregular'
        

        self.period = self.oscillator.get_period()
        self.observation_period = 60.0
        self.eval_len = self.oscillator.get_eval_len()
        # numero di elementi del vettore buff_hist che rappresentano un periodo d'onda
        self.buff_len = self.observation_period * (1 / self.d_t)
        
        # numero di periodi da osservare
        self.attention_win = 5

        self.attention_len = self.attention_win * int(self.buff_len)

        # buffer che mantiene solo gli elementi più recenti
        self.buff_hist = deque(maxlen= self.attention_len)
        
        self.set_sim_path(sim_dir)

        # Contatore che tiene traccia di quanti salvataggi sono stati effettuati
        self.cycle_counter = 0

        self.max_cycle = self.sim_time // (self.observation_period * self.attention_win)

        self.supp_buff = []
        self.energy_buff = []
        self.total_energy_absorbed = 0.0
    
    def set_sim_path(self, sim_dir):
        
        self.sim_dir = sim_dir

        file_name_single = ""
        file_name_mixed = ""

        if self.sim_mode == 'train':
            file_name_single = f'simulation{self.sim_name}_{self.control_mode}_{str(self.sim_time / 3600)}h_{f"{self.d_t}".replace('.','')}s_{self.oscillator.get_wave_height()}_{self.oscillator.get_period()}_{self.wave_mode}'
            file_name_mixed = f'simulation_mixed{self.sim_name}_{self.control_mode}_{str(self.sim_time / 3600)}h_{f"{self.d_t}".replace('.','')}s_{self.wave_mode}'
        
        else:
            file_name_single = f'simulation{self.sim_name}_{self.control_mode}_{str(self.sim_time)}s_{f"{self.d_t}".replace('.','')}s_{self.oscillator.get_wave_height()}_{self.oscillator.get_period()}_{self.wave_mode}'
            file_name_mixed = f'simulation_mixed{self.sim_name}_{self.control_mode}_{str(self.sim_time)}s_{f"{self.d_t}".replace('.','')}s_{self.wave_mode}'
            
        self.file_name = file_name_mixed if self.mixed_sea_state else file_name_single
        
        # self.base_data_name = f'./results/{self.sim_dir}/{self.sim_mode}/data/{self.wave_mode}/sea_state_{self.oscillator.get_wave_height()}_{self.oscillator.get_period()}'
        # self.base_plot_name = f'./results/{self.sim_dir}/{self.sim_mode}/plot/{self.wave_mode}/sea_state_{self.oscillator.get_wave_height()}_{self.oscillator.get_period()}'
        
        base_data_name_single = f'{sim_dir}/{self.sim_mode}/data/{self.wave_mode}/sea_state_{self.oscillator.get_wave_height()}_{self.oscillator.get_period()}'
        base_plot_name_single = f'{sim_dir}/{self.sim_mode}/plot/{self.wave_mode}/sea_state_{self.oscillator.get_wave_height()}_{self.oscillator.get_period()}'

        base_data_name_mixed = f'{sim_dir}/{self.sim_mode}/data/{self.wave_mode}/sea_state_mixed'
        base_plot_name_mixed = f'{sim_dir}/{self.sim_mode}/plot/{self.wave_mode}/sea_state_mixed'

        self.base_data_name = base_data_name_mixed if self.mixed_sea_state else base_data_name_single
        self.base_plot_name = base_plot_name_mixed if self.mixed_sea_state else base_plot_name_single
        
        self.results_path       = f'{self.base_data_name}/{self.file_name}.csv'
        self.energy_path        = f'{self.base_data_name}/{self.file_name}_energy_absorbed.csv'
        self.reward_path        = f'{self.base_data_name}/{self.file_name}_reward.csv'
        
        self.plot_path          = f'{self.base_plot_name}/{self.file_name}.png'
        self.plot_energy_path   = f'{self.base_plot_name}/{self.file_name}_energy_absorbed.png'
        self.plot_reward_path   = f'{self.base_plot_name}/{self.file_name}_reward.png'

        for path in [self.results_path, self.energy_path, self.reward_path, self.plot_path, self.plot_energy_path, self.plot_reward_path]:
            
            if os.path.exists(path):
                os.remove(path)

        for dir in [self.base_data_name, self.base_plot_name]:

            if not os.path.exists(dir):
                os.makedirs(dir)


    def get_save_mode(self):
        return self.save_mode


    def get_state(self):
        return self.current_state


    def get_warmup_values(self):
        return {
            "x_warmup": self.x_max,
            "v_warmup": self.v_max,
            "fet_warmup": self.fet_max,
            "opt_damping": self.oscillator.get_opt_damping_pto(),
            "opt_stifness": self.oscillator.get_opt_stifness_pto(),
            "period": self.oscillator.get_period(),
            "hw": self.oscillator.get_wave_height()
        }


    def load_warmup_values(self, init_values, file_path = './utils/warmup.json'):
        period, Hw = init_values

        with open(file_path, "r") as f:
            warmup_values = json.load(f)

        mode = self.oscillator.get_wmode()
        w_mode = 'regular' if mode else 'irregular'
        w_params = f"T_{period}_Hw_{Hw}"
        w_v = warmup_values[w_mode][w_params]

        self.x_max = np.float64(w_v["x_max"])
        self.v_max = np.float64(w_v["v_max"])
        self.fet_max = np.float64(w_v["fet_max"])

        self.reset()


    def get_oscillator(self):
        return self.oscillator


    def get_sim_time(self):
        return self.sim_time


    def get_sim_mode(self):
        return self.sim_mode


    def get_current_time(self):
        return self.current_t


    def get_control_mode(self):
        return self.control_mode


    def write_buffer_to_file(self, buff, r):
        """Scrive il contenuto del buffer su file"""
        if not buff:
            return
            
        # Estrai i dati dal buffer
        data_to_write = []
        
        for entry in buff:
            t_arr, x_arr, v_arr, fet_arr, wave_t_arr, damp_arr, stif_arr, pow_inst_arr, u_latch_arr, g_star_arr, ss_arr = entry
            
            for t, x, v, fet, wave_t, damp, stif, pow_inst, u_latch, g_star, ss in zip(t_arr, x_arr, v_arr, fet_arr, wave_t_arr, damp_arr, stif_arr, pow_inst_arr, u_latch_arr, g_star_arr, ss_arr):
                data_to_write.append({
                    "time": t,
                    "position": x,
                    "velocity": v,
                    "excitation_force": fet,
                    "wave_t": wave_t,
                    "damping_fpto": damp,
                    "stifness_fpto": stif,
                    "u_latching": u_latch,
                    "G_star": g_star,
                    "power_inst": pow_inst,
                    "sea_state": ss
                })
        
        mean_energy = []
        
        # CONTROL ENERGY WAVE AND ETA
        #########################################
        if r > 0:
            energy_abs = [x[1] for x in self.energy_buff]
            energy_abs = np.sum(energy_abs) ## energia catturata in una finestra di osservazione [J]
            energy_wave = self.oscillator.get_wave_energy() ## energia dell'onda in un determinato sea state
            eta = energy_abs / (energy_wave * (r / self.period))

        else:
            energy_abs = [x[1] for x in self.energy_buff]
            energy_abs = np.sum(energy_abs) ## energia catturata in una finestra di osservazione [J]
            energy_wave = self.oscillator.get_wave_energy() ## energia dell'onda in un determinato sea state
            eta = energy_abs / (energy_wave * self.attention_win)
        
        mean_energy.append({
            "time": self.current_t,
            "energy_abs":energy_abs,## Energy absorbed
            "eta" : eta, ## Capture Width Ratio
            "period_sea_state": self.current_ss
        })
        ##########################################
        self.energy_buff.clear()
        
        # Scrivi su file
        df = pd.DataFrame(data_to_write)
        header = not os.path.exists(self.results_path)
        df.to_csv(self.results_path, mode='a', header=header, index=False)

        df_energy = pd.DataFrame(mean_energy)
        header = not os.path.exists(self.energy_path)
        df_energy.to_csv(self.energy_path, mode='a', header= header, index=False)


    def send_control_linear(self, control):
        new_C = control[0]
        new_K = control[1]
        if new_C and new_K is not None:
            self.oscillator.set_fpto(new_C, new_K)


    def send_control_latching(self, control):
        new_u, new_G_star = control
        if new_u is not None:
            self.oscillator.set_latching(new_u)
            self.oscillator.set_G_star(new_G_star)

    
    def calculate_total_energy_absorbed(self):
        df = pd.read_csv(self.energy_path)
        energy = df['energy_abs']
        self.total_energy_absorbed = np.sum(energy) * 10 **-6
    

    def get_total_energy_absorbed(self):
        return self.total_energy_absorbed

    
    def plot(self):

        for f in [self.results_path, self.energy_path]:
            if not os.path.exists(f):
                logger.error(f"Nessun file {f} trovato...")
                return
        
        df = pd.read_csv(self.results_path)
        df_energy = pd.read_csv(self.energy_path)
        df_plot_last = df.tail(2500)
        
        if self.sim_mode == 'train':

            if self.control_mode == 'linear':
                plot_linear(df, df_energy, df_plot_last, self.save_mode, self.plot_path)
            
            else:
                plot_latching(df, df_energy, df_plot_last, self.save_mode, self.plot_path)
        
            
            plot_energy(self.save_mode, self.energy_path, self.plot_energy_path)
            plot_reward(self.save_mode, self.reward_path, self.plot_reward_path)
        
        elif self.sim_mode == 'test':

            plot_test(df_plot_last, self.save_mode, self.plot_path)
            
            self.calculate_total_energy_absorbed()

        if self.show_results:
            plt.show()
            logger.info("\nShow plots...\n")
        
        else:
            plt.close()

    # pulisce i file csv se save_mode = 0
    def clear(self):
        for path in [self.results_path, self.energy_path, self.reward_path]:
            if os.path.exists(path):
                os.remove(path)


    def reset(self):
        # position - speed - f_pto_damp - f_pto_stif - u_latching - G_star
        self.current_state = (0.0, 0.0, 0.0, 0.0, 0.0, 0.0)
        self.current_t = 0.0
        self.buff_hist.clear()
        self.cycle_counter = 0
        self.supp_buff = []
        self.energy_buff = []
        self.total_energy_absorbed = 0.0
        
        for path in [self.results_path, self.energy_path, self.plot_path, self.plot_energy_path]:
            if os.path.exists(path):
                os.remove(path)

        
    def update_sea_state(self, sea_state):
        self.oscillator.update_sea_state(sea_state)
        # aggiorna il sea state e il periodo
        self.current_ss = sea_state
        table_period = self.oscillator.get_table_period()
        self.period = table_period[self.current_ss]

    def get_period_zero(self):
        return self.oscillator.get_period_zero()
        
    # def get_omega_zero(self):
    #     return self.oscillator.get_omega_zero()
    
    def step(self):
        if self.current_t > 0.0:
            t_span = (self.current_t + (self.d_t / self.eval_len), self.current_t + self.d_t)
        else:
            t_span = (self.current_t, self.current_t + self.d_t)
        
        init_conditions = (self.get_state()[0], self.get_state()[1])
        self.oscillator.solve(t_span=t_span, initial_conditions= init_conditions)

        x = self.oscillator.get_position()
        v = self.oscillator.get_speed()
        fet = self.oscillator.get_fet()
        t = self.oscillator.get_timevector()
        wave_t = self.oscillator.get_wavet()
        period = self.oscillator.get_period()
        Hw = self.oscillator.get_wave_height()
        w_mode = self.oscillator.get_wmode()

        d_fpto = self.oscillator.get_fpto_damping()
        s_fpto = self.oscillator.get_fpto_stifness()

        sea_state = self.oscillator.get_sea_state()
        sea_state_array = np.full(shape = self.eval_len, fill_value= sea_state)

        
        damping_fpto_array = np.full(shape = self.eval_len, fill_value= self.oscillator.get_fpto_damping())
        stifness_fpto_array = np.full(shape= self.eval_len, fill_value= self.oscillator.get_fpto_stifness())
        
        pow_inst = self.oscillator.get_pow_inst()
        energy = self.oscillator.get_energy()
        self.energy_buff.append((t[-1], energy))
        
        if self.control_mode == 'linear':
            # valore di default quando non viene utilizzato il latching control
            self.oscillator.set_latching(u = -1.0)
            u_latching = self.oscillator.get_latching()
            u_latching_array = np.full(shape=self.eval_len, fill_value= u_latching)
            
            self.oscillator.set_G_star(g_star = -1.0)
            g_star = self.oscillator.get_G_star()
            g_star_array = np.full(shape=self.eval_len, fill_value= g_star)


        elif self.control_mode == 'latching':
            u_latching = self.oscillator.get_latching()
            u_latching_array = np.full(shape=self.eval_len, fill_value= u_latching)
            
            g_star = self.oscillator.get_G_star()
            g_star_array = np.full(shape=self.eval_len, fill_value= g_star)


        self.current_state = (x[-1], v[-1], d_fpto, s_fpto, u_latching, g_star)
        self.current_t = round(t[-1], 2)

        self.buff_hist.append((t, x, v, fet, wave_t, damping_fpto_array, stifness_fpto_array, pow_inst, u_latching_array, g_star_array, sea_state_array))
        
        if self.cycle_counter >= self.max_cycle:
            self.supp_buff.append((t, x, v, fet, wave_t, damping_fpto_array, stifness_fpto_array, pow_inst, u_latching_array, g_star_array, sea_state_array))
            
            if self.current_t >= self.sim_time:
                r = self.sim_time % (self.period * self.attention_win)
                self.write_buffer_to_file(self.supp_buff, r)

        
        elif (self.current_t  % (self.observation_period * self.attention_win)) == 0:
            r = 0
            self.write_buffer_to_file(self.buff_hist, r)
            self.cycle_counter += 1


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