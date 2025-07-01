import matplotlib.pyplot as plt
import numpy as np
from collections import deque
import pandas as pd
import os
import json

class Simulation:
    def __init__(self, oscillator,sim_time, d_t, save_mode):
        
        self.oscillator = oscillator
        self.sim_time = sim_time
        self.d_t = d_t
        self.save_mode = save_mode
        self.control_mode = self.oscillator.get_control_mode()

        # position - speed - f_pto_damp - f_pto_stif - u_latching
        self.current_state = (0.0, 0.0, 0.0, 0.0, 0.0)


        self.current_t = 0.0

        self.wave_mode = 'regular' if self.oscillator.get_wmode() else 'irregular'
        

        self.period = self.oscillator.get_period()
        self.eval_len = self.oscillator.get_eval_len()
        # numero di elementi del vettore buff_hist che rappresentano un periodo d'onda
        self.buff_len = self.period * (1 / self.d_t)
        
        # numero di periodi da osservare
        self.attention_win = 1

        self.attention_len = self.attention_win * int(self.buff_len)

        # buffer che mantiene solo gli elementi più recenti
        self.buff_hist = deque(maxlen= self.attention_len)
        
        base_name = f'simulation_{self.control_mode}_{int(self.sim_time)}_{f"{self.d_t}".replace('.','')}_{self.oscillator.get_wave_height()}_{self.oscillator.get_period()}_{self.wave_mode}'

        self.results_path       = f'./results/{self.wave_mode}/{base_name}.csv'
        self.energy_path        = f'./results/{self.wave_mode}/{base_name}_energy_absorbed.csv'
        self.reward_path        = f'./results/{self.wave_mode}/{base_name}_reward.csv'
        
        self.plot_path          = f'./plot/{self.wave_mode}/{base_name}.png'
        self.plot_energy_path   = f'./plot/{self.wave_mode}/{base_name}_energy_absorbed.png'
        self.plot_reward_path   = f'./plot/{self.wave_mode}/{base_name}_reward.png'
        # Inizializza il file (rimuovi se esiste)
        
        for path in [self.results_path, self.energy_path, self.reward_path, self.plot_path, self.plot_energy_path, self.plot_reward_path]:
            if os.path.exists(path):
                os.remove(path)

        

        # Contatore che tiene traccia di quanti salvataggi sono stati effettuati
        self.cycle_counter = 0

        self.max_cycle = self.sim_time // (self.period * self.attention_win)

        self.supp_buff = []
        self.energy_buff = []
        

    def get_state(self):
        return self.current_state
    
    def get_warmup_values(self):
        return (self.x_max, self.v_max, self.oscillator.get_opt_damping_pto(), self.oscillator.get_opt_stifness_pto(), self.oscillator.get_period(), self.oscillator.get_wave_height())
    
    def get_sim_time(self):
        return self.sim_time
    
    def get_current_time(self):
        return self.current_t
    
    def write_buffer_to_file(self, buff):
        """Scrive il contenuto del buffer su file"""
        if not buff:
            return
            
        # Estrai i dati dal buffer
        data_to_write = []
        
        for entry in buff:
            t_arr, x_arr, v_arr, fet_arr, wave_t_arr, damp_arr, stif_arr, pow_inst_arr, u_latch_arr = entry
            
            for t, x, v, fet, wave_t, damp, stif, pow_inst, u_latch in zip(t_arr, x_arr, v_arr, fet_arr, wave_t_arr, damp_arr, stif_arr, pow_inst_arr, u_latch_arr):
                data_to_write.append({
                    "time": t,
                    "position": x,
                    "velocity": v,
                    "excitation_force": fet * 10e-6,
                    "wave_t": wave_t,
                    "damping_fpto": damp,
                    "stifness_fpto": stif,
                    "u_latching": u_latch,
                    "power_inst": pow_inst
                })
        
        mean_energy = []
        
        # CONTROL ENERGY WAVE AND ETA
        #########################################
        energy_abs = [x[1] for x in self.energy_buff]
        energy_wave = [x[2] for x in self.energy_buff]
        eta = [x[3] for x in self.energy_buff]

        mean_energy.append({
            "time": self.current_t,
            # controlla 
            "energy_abs": np.sum(energy_abs) / (self.period * self.attention_win),
            "energy_wave": np.sum(energy_wave) / (self.period * self.attention_win),
            "eta" : np.sum(eta) / self.buff_len
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
            #self.oscillator.set_control(new_C, new_K)
            self.oscillator.set_fpto(new_C, new_K)
            #print(f"Set nuovo valore di C: {new_C}")

    def send_control_latching(self, control):
        new_u = control
        if new_u is not None:
            self.oscillator.set_latching(new_u)

    def plot_energy(self):
        if not os.path.exists(self.energy_path):
            print("Nessun file di dati trovato per il plotting")
            return
        
        df = pd.read_csv(self.energy_path)

        t = df['time']
        power = df['energy_abs']

        # Crea il grafico
        plt.figure(figsize=(10, 5))
        plt.plot(t, power, label='Potenza media', color='royalblue')

        # Etichette e titolo
        plt.xlabel('Tempo (s)')
        plt.ylabel('Potenza media (W)')
        plt.title('Potenza media nel tempo')
        plt.grid(True)
        plt.legend()
        plt.tight_layout()

        # Mostra o salva il grafico

        if self.save_mode:
            plt.savefig(self.plot_energy_path, dpi = 300)
        
        plt.show()


    def plot_reward(self):

        if not os.path.exists(self.reward_path):
            print("Nessun file di dati trovato per il plotting")
            return
        
        df = pd.read_csv(self.reward_path)

        step = df['step']
        reward = df['reward']

        # Crea il grafico
        plt.figure(figsize=(10, 5))
        plt.plot(step, reward, label='Reward', color='purple')

        # Etichette e titolo
        plt.xlabel('Step (s)')
        plt.ylabel('Reward')
        plt.title('Reward ottenuto per ogni step')
        plt.grid(True)
        plt.legend()
        plt.tight_layout()

        # Mostra o salva il grafico

        if self.save_mode:
            plt.savefig(self.plot_reward_path, dpi = 300)
        
        plt.show()

    
    
    def plot(self):
        """Plot dei risultati leggendo dal file salvato"""
        if not os.path.exists(self.results_path):
            print("Nessun file di dati trovato per il plotting")
            return
            
        df = pd.read_csv(self.results_path)
        
        # Prendi gli ultimi 2500 punti per il plotting
        df_plot_last = df.tail(2500)
        
        fig, ax = plt.subplots(nrows=2, ncols=2, figsize=(15, 8))
        fig.tight_layout(pad=3.0)
        
        # Subplot 1: Displacement (top-left)
        ax[0, 0].plot(df_plot_last['time'], df_plot_last['position'], label=r'Buoy displacement $\xi(t)$')
        ax[0, 0].plot(df_plot_last['time'], df_plot_last['wave_t'], label=r'Wave displacement $\zeta (t)$', color='#17becf',linestyle='dashed')
        ax[0, 0].set_xlabel(r'$t$ [s]')
        ax[0, 0].set_ylabel(r'Displacement [m]')
        ax[0, 0].legend(loc='lower right', fontsize='small')
        ax[0, 0].grid()
        
        # Subplot 2: Velocity and Excitation Force (top-right)
        ax[0, 1].plot(df_plot_last['time'], df_plot_last['velocity'], label=r'Buoy velocity $\dot{\xi}(t)$', color='red')
        ax[0, 1].plot(df_plot_last['time'], df_plot_last['excitation_force'], label=r'Excitation force $10^{-6} \times f_{e}(T)$', color='#1b9e77', linestyle='dashed')
        ax[0, 1].set_xlabel(r'$t$ [s]')
        ax[0, 1].set_ylabel("Velocity [m/s]\nvs\nWave force [MN]")
        ax[0, 1].legend(loc='lower right', fontsize='small')
        ax[0, 1].grid()

        if self.control_mode == 'linear':
            # Subplot 3: PTO Forces (bottom-left)
            ax[1, 0].plot(df['time'], df['damping_fpto'], label=r'Fpto damping', color='orange')
            ax[1, 0].plot(df['time'], df['stifness_fpto'], label=r'Fpto stifness', color='purple')
            ax[1, 0].set_xlabel(r'$t$ [s]')
            ax[1, 0].set_ylabel("Force [MN]")
            ax[1, 0].legend(loc='lower right', fontsize='small')
            ax[1, 0].grid()

        elif self.control_mode == 'latching':
            # Subplot 3: u-latching (bottom-left)
            ax[1, 0].plot(df_plot_last['time'], df_plot_last['u_latching'], label=r'u control latching', color='green')
            ax[1, 0].set_xlabel(r'$t$ [s]')
            ax[1, 0].set_ylabel("Binary Control")
            ax[1, 0].legend(loc='lower right', fontsize='small')
            ax[1, 0].grid()

        
        # Subplot 4: Instantaneous Power (bottom-right)
        ax[1, 1].plot(df['time'], df['power_inst'], label=r'Inst. Power', color='orange')
        ax[1, 1].set_xlabel(r'$t$ [s]')
        ax[1, 1].set_ylabel("Inst. Power [W]")
        ax[1, 1].legend(loc='lower right', fontsize='small')
        ax[1, 1].grid()
        

        if self.save_mode:
            plt.savefig(self.plot_path, dpi = 300)
        
        self.plot_energy()
        self.plot_reward()
        
        plt.show()



    def reset(self):
        # position - speed - f_pto_damp - f_pto_stif - u_latching
        self.current_state = (0.0, 0.0, 0.0, 0.0, 0.0)
        self.current_t = 0.0
        self.buff_hist.clear()
        self.cycle_counter = 0
        
        for path in [self.results_path, self.energy_path, self.plot_path, self.plot_energy_path]:
            if os.path.exists(path):
                os.remove(path)

    def get_history(self):
        """Legge la storia dal file invece che dalla memoria"""
        if os.path.exists(self.results_path):
            df = pd.read_csv(self.results_path)
            return {
                "time": df['time'].values,
                "position": df['position'].values,
                "velocity": df['velocity'].values,
                "excitation_force": df['excitation_force'].values,
                "wave_t": df['wave_t'].values,
                "damping_fpto": df['damping_fpto'].values,
                "stifness_fpto": df['stifness_fpto'].values,
                "power_inst": df['power_inst'].values
            }
        else:
            return {}
        
    def update_values(self, period, Hw):
        self.oscillator.update_values(period, Hw)

    def load_warmup_values(self, init_values, file_path = './warmup.json'):
        period, Hw = init_values

        with open(file_path, "r") as f:
            warmup_values = json.load(f)

        mode = self.oscillator.get_wmode()
        w_mode = 'regular' if mode else 'irregular'
        w_params = f"T_{period}_Hw_{Hw}"
        w_v = warmup_values[w_mode][w_params]

        self.x_max = np.float64(w_v["x_max"])
        self.v_max = np.float64(w_v["v_max"])

        self.reset()

    # def warmup(self, warmup_time):
    #     #n_sim = 100 if self.mode == 'regular' else 50
    #     n_sim = 100
    #     opt_fpto_damp = self.oscillator.get_opt_damping_pto()
    #     opt_fpto_stif = self.oscillator.get_opt_stifness_pto()
    #     initial_fpto_damp = self.oscillator.get_fpto_damping()
    #     initial_fpto_stif = self.oscillator.get_fpto_stifness()

    #     #initial_period = self.oscillator.get_period()
    #     #initial_Hw = self.oscillator.get_wave_height()

    #     #init_period_v, init_Hw_v = init_values

    #     random_ptod_v = np.random.uniform(low = initial_fpto_damp, high = opt_fpto_damp, size=(n_sim,))
    #     random_ptos_v = np.random.uniform(low=initial_fpto_stif, high= opt_fpto_stif, size= (n_sim,))
        
    #     #random_period_v = np.random.randint(low= init_period_v[0], high= init_period_v[1], size= (n_sim,))
    #     #random_Hw_v = np.random.uniform(low= init_Hw_v[0], high= init_Hw_v[1], size= (n_sim))

    #     v_arr = []
    #     x_arr = []
    #     for re_d, re_s in zip(random_ptod_v, random_ptos_v):
    #         self.oscillator.set_fpto(re_d, re_s)
    #         #self.oscillator.update_values(re_p, re_hw)
            
    #         t_span = (0, warmup_time) if 'regular' else (0, warmup_time*2)
    #         t_eval = np.linspace(t_span[0], t_span[1], 1000)
    #         self.oscillator.solve(t_span = t_span, t_eval = t_eval)
    #         x = np.absolute(self.oscillator.get_position())
    #         v = np.absolute(self.oscillator.get_speed())
    #         x_arr.append(np.max(x))
    #         v_arr.append(np.max(v))
        
    #     self.x_max = np.max(x_arr)
    #     self.v_max = np.max(v_arr)

    #     print(type(self.x_max))

    #     # riconfigura i parametri iniziali reali
    #     self.oscillator.set_fpto(initial_fpto_damp, initial_fpto_stif)
    #     #self.oscillator.update_values(initial_period, initial_Hw)
        
    #     self.reset()

    
    
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

        
        damping_fpto_array = np.full(shape = self.eval_len, fill_value= self.oscillator.get_fpto_damping())
        stifness_fpto_array = np.full(shape= self.eval_len, fill_value= self.oscillator.get_fpto_stifness())
        
        pow_inst = self.oscillator.get_pow_inst()
        energy = self.oscillator.get_energy()
        energy_wave = self.oscillator.get_wave_energy()
        eta = self.oscillator.get_eta()
        
        self.energy_buff.append((t[-1], energy, energy_wave, eta))
        
        if self.control_mode == 'linear':
            # valore di default quando non viene utilizzato il latching control
            self.oscillator.set_latching(u = -1.0)
            u_latching = self.oscillator.get_latching()
            u_latching_array = np.full(shape=self.eval_len, fill_value= u_latching)

        elif self.control_mode == 'latching':
            u_latching = self.oscillator.get_latching()
            u_latching_array = np.full(shape=self.eval_len, fill_value= u_latching)


        
        self.buff_hist.append((t, x, v, fet, wave_t, damping_fpto_array, stifness_fpto_array, pow_inst, u_latching_array))
        self.current_state = (x[-1], v[-1], d_fpto, s_fpto, u_latching)
        self.current_t = round(t[-1], 2)

        bh = np.array(self.buff_hist)
        h_avg_p = np.mean(bh[:,1])
        h_avg_v = np.mean(bh[:,2])
        h_max_p = np.max(np.abs(bh[:,1]))
        h_max_v = np.max(np.abs(bh[:,2]))
        h_avg_damp = np.mean(bh[:,5])
        h_avg_stif = np.mean(bh[:,6])
        h_pow_avg = (h_avg_v**2) * h_avg_damp
        
        if self.cycle_counter >= self.max_cycle:
            self.supp_buff.append((t, x, v, fet, wave_t, damping_fpto_array, stifness_fpto_array, pow_inst, u_latching_array))
            
            if self.current_t >= self.sim_time:
                self.write_buffer_to_file(self.supp_buff)

        
        if (self.current_t  % (self.period * self.attention_win)) == 0:
            self.write_buffer_to_file(self.buff_hist)
            self.cycle_counter += 1


        state = {
            'time': round(t[-1], 1),
            'position': round(x[-1], 3),
            'velocity': round(v[-1], 3),
            'excitation_force': round(fet[-1], 3),
            'f_pto_damp': d_fpto,
            'f_pto_stif': s_fpto,
            'u_latching': u_latching,
            'period': period,
            'wave_height': Hw,
            'w_mode': w_mode,
            'H_avg_position': h_avg_p,
            'H_max_position': h_max_p,
            'H_avg_velocity': h_avg_v,
            'H_max_velocity': h_max_v,
            'H_avg_fpto_damp': h_avg_damp,
            'H_avg_fpto_stif': h_avg_stif,
            'H_avg_pow_avg' : h_pow_avg
        }
        
        return state

    # pulisce i file csv se save_mode = 0
    def clear(self):
        for path in [self.results_path, self.energy_path, self.reward_path]:
            if os.path.exists(path):
                os.remove(path)