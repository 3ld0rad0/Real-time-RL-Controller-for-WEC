import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import matplotlib.pyplot as plt
import pandas as pd
import numpy as np
import logging
import utils.mpl_utils as mut
from  utils.mpl_utils import linecolors
mut.config_plots()
from matplotlib_inline.backend_inline import set_matplotlib_formats
set_matplotlib_formats('svg')

logger = logging.getLogger(__name__)


def load_and_process_data(csv_file_path, regular):
    """
    Carica e processa i dati dal file CSV
    """
    # Leggi il CSV
    df = pd.read_csv(csv_file_path)

    if regular:
        df['method'] = df.apply(lambda row: 
            'Optimal Control' if row['control_type'] == 'optimal_control'
            else 'RL Control', axis=1
            )
    
    else:
    
        # Crea una colonna per identificare il metodo di controllo
        df['method'] = df.apply(lambda row: 
            'Threshold Control' if row['control_type'] == 'threshold_control'
            else 'RL Control (Fine-tuned)' if (row['control_type'] == 'rl_control' and row['fine_tuned_model'] == True)
            else 'RL Control', axis=1
        )
    
    return df

def plot_energy_abs_bar_charts(df, ss, regular, save_path=None):
    """
    Crea i grafici a barre per i diversi valori di C* con stile più curato
    """
    # --- Setup valori unici ---
    c_star_values = sorted(df['C_star'].unique())
    n_plots = len(c_star_values)

    # --- Dimensione dinamica (più compatta) ---
    base_width = 4.5
    height = 4.5
    fig, axes = plt.subplots(1, n_plots, figsize=(base_width * n_plots, height))

    if n_plots == 1:
        axes = [axes]

    # --- Definisci colori ---
    if regular:
        colors = {
            'Optimal Control': '#E76F51',
            'RL Control': '#2A9D8F'
        }
    else:
        colors = {
            'Threshold Control': '#E76F51',
            'RL Control': '#457B9D',
            'RL Control (Fine-tuned)': '#2A9D8F'
        }

    # --- Loop sui subplot ---
    for i, c_star in enumerate(c_star_values):
        data_subset = df[(df['C_star'] == c_star) & (df['sea_state'] == ss)]
        grouped_data = data_subset.groupby('method')['energy_abs'].mean()

        methods = grouped_data.index.tolist()
        values = grouped_data.values.tolist()

        bar_colors = [colors.get(method, '#95a5a6') for method in methods]

        # --- Barre ---
        bars = axes[i].bar(methods, values, width=0.55, color=bar_colors,
                           alpha=0.9, edgecolor='black', linewidth=0.8)

        # --- Titoli e assi ---
        axes[i].set_title(f'C* = {c_star}', fontsize=12, fontweight='bold', pad=10)
        if i == 0:
            axes[i].set_ylabel('Energy Absorption (MJ)', fontsize=11)
        axes[i].grid(axis='y', alpha=0.25, linestyle='--', linewidth=0.7)
        axes[i].set_axisbelow(True)
        axes[i].tick_params(axis='x', rotation=30, labelsize=10)

        # --- Etichette valori sulle barre ---
        for bar, value in zip(bars, values):
            height = bar.get_height()
            axes[i].text(bar.get_x() + bar.get_width()/2., height * 1.01,
                         f'{value:.2f}',
                         ha='center', va='bottom', fontsize=9,
                         bbox=dict(facecolor='white', alpha=0.7, edgecolor='none', pad=1))

        # --- Y limit dinamico ---
        axes[i].set_ylim(0, max(values) * 1.2)

    # --- Layout compatto e margini ---
    plt.subplots_adjust(wspace=0.3, top=0.88)
    fig.suptitle(
        f'Energia Catturata per Diversi Valori di C*, Sea-State = {ss}',
        fontsize=14, fontweight='bold'
    )

    # --- Salva o mostra ---
    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        print(f"Grafico salvato in: {save_path}")
    
    #plt.show()


def plot_power_bar_charts(df, ss, regular, save_path=None):
    """
    Crea i grafici a barre per la potenza media (kW) per i diversi valori di C*
    """
    # Calcola la potenza media in kW (energia in MJ / tempo in secondi * 1000)
    df['power_avg_kw'] = (df['energy_abs'] / df['test_time']) * 1000
    
    # Ottieni i valori unici di C* e ordinali
    c_star_values = sorted(df['C_star'].unique())
    n_plots = len(c_star_values)

    # --- Dimensione dinamica del grafico ---
    base_width = 4.5   # più snello rispetto a 7
    height = 4.5
    fig, axes = plt.subplots(1, n_plots, figsize=(base_width * n_plots, height))

    if n_plots == 1:
        axes = [axes]

    # --- Colori armonizzati ---
    if regular:
        colors = {
            'Optimal Control': '#E76F51',
            'RL Control': '#2A9D8F'
        }
    else:
        colors = {
            'Threshold Control': '#E76F51',
            'RL Control': '#457B9D',
            'RL Control (Fine-tuned)': '#2A9D8F'
        }

    # --- Loop su ogni subplot ---
    for i, c_star in enumerate(c_star_values):
        # Filtra i dati per il valore corrente di C* e sea state
        data_subset_ss = df[(df['C_star'] == c_star) & (df['sea_state'] == ss)]

        grouped_data = data_subset_ss.groupby('method')['power_avg_kw'].mean()

        methods = grouped_data.index.tolist()
        values = grouped_data.values.tolist()

        bar_colors = [colors.get(method, '#95a5a6') for method in methods]

        # --- Crea le barre ---
        bars = axes[i].bar(
            methods, values, width=0.55,
            color=bar_colors, alpha=0.9,
            edgecolor='black', linewidth=0.8
        )

        # --- Titoli e assi ---
        axes[i].set_title(f'C* = {c_star}', fontsize=12, fontweight='bold', pad=10)
        if i == 0:
            axes[i].set_ylabel('Potenza Media (kW)', fontsize=11)
        axes[i].grid(axis='y', alpha=0.25, linestyle='--', linewidth=0.7)
        axes[i].set_axisbelow(True)
        axes[i].tick_params(axis='x', rotation=30, labelsize=10)

        # --- Etichette valori sopra le barre ---
        for bar, value in zip(bars, values):
            height = bar.get_height()
            axes[i].text(
                bar.get_x() + bar.get_width()/2., height * 1.01,
                f'{value:.2f}',
                ha='center', va='bottom', fontsize=9,
                bbox=dict(facecolor='white', alpha=0.7, edgecolor='none', pad=1)
            )

        # --- Limiti asse Y ---
        if values:
            axes[i].set_ylim(0, max(values) * 1.2)

    # --- Layout e titolo ---
    plt.subplots_adjust(wspace=0.3, top=0.85)
    fig.suptitle(
        f'Potenza Media per Diversi Valori di C*, Sea-State = {ss}',
        fontsize=14, fontweight='bold'
    )

    # --- Salva o mostra ---
    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        print(f"Grafico potenza salvato in: {save_path}")

    #plt.show()


def plot_energy(save_mode, results_path, plot_path):
        if not os.path.exists(results_path):
            print("Nessun file di dati trovato per il plotting")
            return
        
        df = pd.read_csv(results_path)

        t = df['time']
        energy = df['energy_abs']

        # Crea il grafico
        plt.figure(figsize=(10, 5))
        plt.plot(t / 3600, energy * 10 **-6, label=r'Potenza media $10^{-6}$', color='royalblue')

        # Etichette e titolo
        plt.xlabel('Tempo (h)')
        plt.ylabel('Energia (MJ)')
        plt.title('Energia media nel tempo')
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
        reward = df['reward_mean']

        # Crea il grafico
        plt.figure(figsize=(10, 5))
        plt.plot(step, reward, label='Reward', color='purple')

        # Etichette e titolo
        plt.xlabel('Step')
        plt.ylabel('Reward')
        plt.title('Mean Reward')
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
        ax[1, 1].plot(data['time']/3600, data['power_inst'] * 10**-3, label=r'Inst. Power $10^{-3}$', color='orange')
        ax[1, 1].set_xlabel(r'$t$ [h]')
        ax[1, 1].set_ylabel("Inst. Power [KW]")
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
        ax[2, 0].plot(data['time']/3600, data['power_inst'] * 10**-3, label=r'Inst. Power $10^{-3}$', color='orange')
        ax[2, 0].set_xlabel(r'$t$ [h]')
        ax[2, 0].set_ylabel("Inst. Power [KW]")
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

def print_summary_table(df, ss):
    """
    Stampa una tabella riassuntiva dei risultati
    """
    print("\n" + "="*60)
    print(f"TABELLA RIASSUNTIVA DELLE PRESTAZIONI, SEA_STATE = {ss}")
    print("="*60)
    
    df_ss = df[df['sea_state'] == ss]
    # Crea una tabella pivot
    pivot_table = df_ss.pivot_table(values='energy_abs', 
                                index='method', 
                                columns='C_star', 
                                aggfunc='mean')
    
    print(pivot_table.round(4))

if __name__ == '__main__':
    
    regular = False
    ss = 0
    file_path = ''
    plot_energy_path = ''
    plot_power_path = ''
    
    if regular:
        file_path = './results/final/data/energy_results_regular_waves.csv'
        plot_energy_path = f'./results/final/plot/energy_results_regular_ss{ss}.png'
        plot_power_path = f'./results/final/plot/power_results_regular_ss{ss}.png'
    
    else:
        file_path = './results/final/data/energy_results_irregular_waves.csv'
        plot_energy_path = f'./results/final/plot/energy_results_irregular_ss{ss}.png'
        plot_power_path = f'./results/final/plot/power_results_irregular_ss{ss}.png'
    
    df = load_and_process_data(file_path, regular)
    ss = 0

    plot_energy_abs_bar_charts(df, ss , regular, save_path = plot_energy_path)
    plot_power_bar_charts(df, ss, regular, save_path= plot_power_path)
    #plt.show()
    print_summary_table(df, ss)