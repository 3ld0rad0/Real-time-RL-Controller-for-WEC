import os
import matplotlib.pyplot as plt
import pandas as pd
import numpy as np
import logging

logger = logging.getLogger(__name__)

def plot_energy(save_mode, results_path, plot_path):
        if not os.path.exists(results_path):
            print("Nessun file di dati trovato per il plotting")
            return
        
        df = pd.read_csv(results_path)

        t = df['time']
        power = df['energy_abs']

        # Crea il grafico
        plt.figure(figsize=(10, 5))
        plt.plot(t / 3600, power * 10 **-6, label=r'Potenza media $10^{-6}$', color='royalblue')

        # Etichette e titolo
        plt.xlabel('Tempo (h)')
        plt.ylabel('Potenza media (MJ)')
        plt.title('Potenza media nel tempo')
        plt.grid(True)
        plt.legend()
        plt.tight_layout()

        # Mostra o salva il grafico

        if save_mode:
            plt.savefig(plot_path, dpi = 300)
            logger.info('\nSave energy results and plots...\n')
        
        #plt.show()


def plot_reward(save_mode, results_path, plot_path):

        if not os.path.exists(results_path):
            print("Nessun file di dati trovato per il plotting")
            return
        
        df = pd.read_csv(results_path)

        step = df['step']
        reward = df['reward']

        # Crea il grafico
        plt.figure(figsize=(10, 5))
        plt.plot(step, reward, label='Reward', color='purple')

        # Etichette e titolo
        plt.xlabel('Step')
        plt.ylabel('Reward')
        plt.title('Reward ottenuto per ogni step')
        plt.grid(True)
        plt.legend()
        plt.tight_layout()

        # Mostra o salva il grafico

        if save_mode:
            plt.savefig(plot_path, dpi = 300)
            logger.info('\nSave reward results and plots...\n')
        
        #plt.show()

    
def plot_linear(data, energy_data, last_data, save_mode, plot_path):
        
        fig, ax = plt.subplots(nrows=3, ncols=2, figsize=(15, 8))
        fig.tight_layout(pad=3.0)

        # Subplot 1: Displacement (top-left)
        ax[0, 0].plot(last_data['time'], last_data['position'], label=r'Buoy displacement $\xi(t)$')
        ax[0, 0].plot(last_data['time'], last_data['wave_t'], label=r'Wave displacement $\zeta (t)$', color='#17becf',linestyle='dashed')
        ax[0, 0].set_xlabel(r'$t$ [s]')
        ax[0, 0].set_ylabel(r'Displacement [m]')
        ax[0, 0].legend(loc='lower right', fontsize='small')
        ax[0, 0].grid()
        
        # Subplot 2: Velocity and Excitation Force (top-right)
        ax[0, 1].plot(last_data['time'] , last_data['velocity'], label=r'Buoy velocity $\dot{\xi}(t)$', color='red')
        ax[0, 1].plot(last_data['time'] , last_data['excitation_force'] * 10**-6, label=r'Excitation force $10^{-6} \times f_{e}(T)$', color='#1b9e77', linestyle='dashed')
        ax[0, 1].set_xlabel(r'$t$ [s]')
        ax[0, 1].set_ylabel("Velocity [m/s]\nvs\nWave force [MN]")
        ax[0, 1].legend(loc='lower right', fontsize='small')
        ax[0, 1].grid()

        # Subplot 3: PTO Forces (bottom-left)
        ax[1, 0].plot(data['time'], data['damping_fpto'] * 10**-6, label=r'Fpto damping $10^{-6}$', color='orange')
        ax[1, 0].plot(data['time'], data['stifness_fpto'] * 10**-6, label=r'Fpto stifness $10^{-6}$', color='purple')
        ax[1, 0].set_xlabel(r'$t$ [s]')
        ax[1, 0].set_ylabel("Force [MN]")
        ax[1, 0].legend(loc='lower right', fontsize='small')
        ax[1, 0].grid()

        # Subplot 4: Instantaneous Power (bottom-right)
        ax[1, 1].plot(data['time']/3600, data['power_inst'] * 10**-6, label=r'Inst. Power $10^{-3}$', color='orange')
        ax[1, 1].set_xlabel(r'$t$ [h]')
        ax[1, 1].set_ylabel("Inst. Power [MJ]")
        ax[1, 1].legend(loc='lower right', fontsize='small')
        ax[1, 1].grid()

        # Subplot 5: Capture Width Ratio(bottom-left)
        ax[2,0].plot(energy_data['time']/3600, energy_data['eta'], label=r'Capture Width Ratio', color='green')
        ax[2,0].set_xlabel(r'$t$ [h]')
        ax[2,0].set_ylabel("CWR")
        ax[2,0].legend(loc='lower right', fontsize='small')
        ax[2,0].grid()

        if save_mode:
            plt.savefig(plot_path, dpi = 300)
            logger.info('\nSave simulation train results and plots...\n')
        

def plot_latching(data, energy_data, last_data, save_mode, plot_path):
        
        fig, ax = plt.subplots(nrows=3, ncols=2, figsize=(15, 8))
        fig.tight_layout(pad=3.0)

        # Subplot 1: Displacement (top-left)
        ax[0, 0].plot(last_data['time'], last_data['position'], label=r'Buoy displacement $\xi(t)$')
        ax[0, 0].plot(last_data['time'], last_data['wave_t'], label=r'Wave displacement $\zeta (t)$', color='#17becf',linestyle='dashed')
        ax[0, 0].set_xlabel(r'$t$ [s]')
        ax[0, 0].set_ylabel(r'Displacement [m]')
        ax[0, 0].legend(loc='lower right', fontsize='small')
        ax[0, 0].grid()
        
        # Subplot 2: Velocity and Excitation Force (top-right)
        ax[0, 1].plot(last_data['time'], last_data['velocity'], label=r'Buoy velocity $\dot{\xi}(t)$', color='red')
        ax[0, 1].plot(last_data['time'], last_data['excitation_force'] * 10**-6, label=r'Excitation force $10^{-6} \times f_{e}(T)$', color='#1b9e77', linestyle='dashed')
        ax[0, 1].set_xlabel(r'$t$ [s]')
        ax[0, 1].set_ylabel("Velocity [m/s]\nvs\nWave force [MN]")
        ax[0, 1].legend(loc='lower right', fontsize='small')
        ax[0, 1].grid()

        # Subplot 3: Latching control u (bottom-left)
        ax[1, 0].plot(last_data['time'], last_data['u_latching'], label=r'u control latching', color='green')
        ax[1, 0].set_xlabel(r'$t$ [s]')
        ax[1, 0].set_ylabel("Binary Control")
        ax[1, 0].legend(loc='lower right', fontsize='small')
        ax[1, 0].set_ylim([0, 1.1])
        ax[1, 0].grid()

        # Subplot 4: G_star(bottom-right)
        ax[1, 1].plot(last_data['time'], last_data['G_star'], label=r'G_star', color='purple')
        ax[1, 1].set_xlabel(r'$t$ [s]')
        ax[1, 1].set_ylabel("G_star[]")
        ax[1, 1].legend(loc='lower right', fontsize='small')
        ax[1, 1].set_ylim([0, 11])
        ax[1, 1].grid()

        # Subplot 5: Instantaneous Power (bottom-right)
        ax[2, 0].plot(data['time']/3600, data['power_inst'] * 10**-6, label=r'Inst. Power $10^{-3}$', color='orange')
        ax[2, 0].set_xlabel(r'$t$ [h]')
        ax[2, 0].set_ylabel("Inst. Power [MJ]")
        ax[2, 0].legend(loc='lower right', fontsize='small')
        ax[2, 0].grid()

        # Subplot 6: Capture Width Ratio(bottom-left)
        ax[2, 1].plot(energy_data['time']/3600, energy_data['eta'], label=r'Capture Width Ratio', color='green')
        ax[2, 1].set_xlabel(r'$t$ [h]')
        ax[2, 1].set_ylabel("CWR")
        ax[2, 1].legend(loc='lower right', fontsize='small')
        ax[2, 1].grid()

        if save_mode:
            plt.savefig(plot_path, dpi = 300)
            logger.info('\nSave simulation train results and plots...\n')
    

def plot_test(last_data, save_mode, plot_path):
        
        fig, ax = plt.subplots(nrows=2, ncols=1, figsize=(15, 8))
        fig.tight_layout(pad=3.0)

        # Subplot 1: Displacement (top-left)
        ax[0].plot(last_data['time'], last_data['position'], label=r'Buoy displacement $\xi(t)$')
        ax[0].plot(last_data['time'], last_data['wave_t'], label=r'Wave displacement $\zeta (t)$', color='#17becf',linestyle='dashed')
        ax[0].set_xlabel(r'$t$ [s]')
        ax[0].set_ylabel(r'Displacement [m]')
        ax[0].legend(loc='lower right', fontsize='small')
        ax[0].grid()
        
        # Subplot 2: Velocity and Excitation Force (top-right)
        ax[1].plot(last_data['time'], last_data['velocity'], label=r'Buoy velocity $\dot{\xi}(t)$', color='red')
        ax[1].plot(last_data['time'], last_data['excitation_force'] * 10**-6, label=r'Excitation force $10^{-6} \times f_{e}(T)$', color='#1b9e77', linestyle='dashed')
        ax[1].set_xlabel(r'$t$ [s]')
        ax[1].set_ylabel("Velocity [m/s]\nvs\nWave force [MN]")
        ax[1].legend(loc='lower right', fontsize='small')
        ax[1].grid()

        if save_mode:
            plt.savefig(plot_path, dpi = 300)
            logger.info('\nSave simulation test results and plots...\n')