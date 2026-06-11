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

# Applico lo stile globale
plt.style.use('seaborn-v0_8-darkgrid')


def load_and_process_data(csv_file_path , regular = False):
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


def plot_energy_abs_bar_charts(src_path, ss, save_path = None, regular = False):
    """
    Crea i grafici a barre per i diversi valori di C* con stile più curato
    """
    
    df = load_and_process_data(src_path)
    df['method'] = pd.Categorical(df['method'], ['Threshold Control','RL Control','RL Control (Fine-tuned)'])
    df.sort_values('method')
    # --- Setup valori unici ---
    c_star_values = sorted(df['C_star'].unique())
    n_plots = len(c_star_values)

    # --- Dimensione dinamica (più compatta) ---
    base_width = 5
    height = 8
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
            'Threshold Control': '#AAFF32',
            'RL Control': '#13EAC9',
            'RL Control (Fine-tuned)': '#0343DF'
        }

    max_value = 0.0
    # --- Loop sui subplot ---
    for i, c_star in enumerate(c_star_values):
        data_subset = df[(df['C_star'] == c_star) & (df['sea_state'] == ss)]
        grouped_data = data_subset.groupby('method', observed = True)['energy_abs'].mean()

        methods = grouped_data.index.tolist()
        values = grouped_data.values.tolist()

        bar_colors = [colors.get(method, '#95a5a6') for method in methods]

        # --- Barre ---
        bars = axes[i].bar(methods, values, width=0.5, color=bar_colors,
                           alpha=0.8, edgecolor='black', linewidth=0.8)

        # --- Titoli e assi ---
        axes[i].set_title(f'C* = {c_star}', fontsize=12, fontweight='bold', pad=10)
        if i == 0:
            axes[i].set_ylabel('Energy Absorption (MJ)', fontsize=12)
        axes[i].grid(axis='y', alpha=0.25, linestyle='--', linewidth=0.7)
        axes[i].set_axisbelow(True)
        axes[i].tick_params(axis='x', rotation=30, labelsize=12)

        # --- Etichette valori sulle barre ---
        for bar, value in zip(bars, values):
            height = bar.get_height()
            axes[i].text(bar.get_x() + bar.get_width()/2., height * 1.01,
                         f'{value:.2f}',
                         ha='center', va='bottom', fontsize=12,
                         bbox=dict(facecolor='white', alpha=0.7, edgecolor='none', pad=1))
            if value > max_value:
                max_value = value

        # --- Y limit dinamico ---
    for i in range(len(c_star_values)):
        axes[i].set_ylim(0, max_value* 1.5)

    # --- Layout compatto e margini ---
    plt.subplots_adjust(wspace=0.3, top=0.88, left=0.08, bottom=0.2)
    fig.suptitle(
        f'Energy absorbed by variable C*, Sea-State = {ss}',
        fontsize=12, fontweight='bold'
    )

    # --- Salva o mostra ---
    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        print(f"Grafico salvato in: {save_path}")
    
    #plt.show()


def plot_power_bar_charts(src_path, ss, save_path = None, regular = False):
    """
    Crea i grafici a barre per la potenza media (kW) per i diversi valori di C*
    """
    df = load_and_process_data(src_path)
    df['method'] = pd.Categorical(df['method'], ['Threshold Control','RL Control','RL Control (Fine-tuned)'])
    df.sort_values('method')
    # Calcola la potenza media in kW (energia in MJ / tempo in secondi * 1000)
    df['power_avg_kw'] = (df['energy_abs'] / df['test_time']) * 1000
    
    # Ottieni i valori unici di C* e ordinali
    c_star_values = sorted(df['C_star'].unique())
    n_plots = len(c_star_values)

    # --- Dimensione dinamica del grafico ---
    base_width = 5   # più snello rispetto a 7
    height = 8
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
            'Threshold Control': '#01153E',
            'RL Control': '#DDA0DD',
            'RL Control (Fine-tuned)': '#FC5A50'
        }

    max_value = 0.0
    # --- Loop su ogni subplot ---
    for i, c_star in enumerate(c_star_values):
        # Filtra i dati per il valore corrente di C* e sea state
        data_subset_ss = df[(df['C_star'] == c_star) & (df['sea_state'] == ss)]

        grouped_data = data_subset_ss.groupby('method', observed = True)['power_avg_kw'].mean()

        methods = grouped_data.index.tolist()
        values = grouped_data.values.tolist()

        bar_colors = [colors.get(method, '#95a5a6') for method in methods]

        # --- Crea le barre ---
        bars = axes[i].bar(
            methods, values, width=0.5,
            color=bar_colors, alpha=0.8,
            edgecolor='black', linewidth=0.8
        )

        # --- Titoli e assi ---
        axes[i].set_title(f'C* = {c_star}', fontsize=12, fontweight='bold', pad=10)
        if i == 0:
            axes[i].set_ylabel('Mean Power (kW)', fontsize=12)
        axes[i].grid(axis='y', alpha=0.25, linestyle='--', linewidth=0.7)
        axes[i].set_axisbelow(True)
        axes[i].tick_params(axis='x', rotation=30, labelsize=10)

        # --- Etichette valori sopra le barre ---
        for bar, value in zip(bars, values):
            height = bar.get_height()
            axes[i].text(
                bar.get_x() + bar.get_width()/2., height * 1.01,
                f'{value:.2f}',
                ha='center', va='bottom', fontsize=12,
                bbox=dict(facecolor='white', alpha=0.7, edgecolor='none', pad=1)
            )
            if value > max_value:
                 max_value = value

        # --- Limiti asse Y ---
    for i in range(len(c_star_values)):
        axes[i].set_ylim(0, max_value* 1.5)

    # --- Layout e titolo ---
    plt.subplots_adjust(wspace=0.3, top=0.88, left=0.08, bottom=0.2)
    fig.suptitle(
        f'Mean Power with variable C*, Sea-State = {ss}',
        fontsize=12, fontweight='bold'
    )

    # --- Salva o mostra ---
    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        print(f"Grafico salvato in: {save_path}")

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
        plt.plot(t / 3600, energy * 10 **-6, label=r'Energia Assorbita $10^{-6}$', color='royalblue')

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
        plt.plot(step, reward, label='Reward (Raw)', color='purple', alpha=0.3)
        
        reward_ma = reward.rolling(window=5, min_periods=1).mean()
        plt.plot(step, reward_ma, label='Reward (MA 5)', color='purple', linewidth=2)

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


def plot_comparative_rewards(src_path, model, C_star = [0.1, 0.3, 0.5], save_path = None):
    path_model = []

    for c in C_star:
        if model == 'ft':
            path_model.append(os.path.join(src_path, f'simulation_latching_16.0h_05s_2.4_11.0_irregular_reward_Cstar{c}.csv'))
        else:
            path_model.append(os.path.join(src_path, f'simulation_mixed_latching_16.0h_05s_irregular_reward_Cstar{c}.csv'))
    
    l_reward_df = []

    for i in range (len(path_model)):
        df = pd.read_csv(path_model[i])
        l_reward_df.append(df)
    
    fig, ax = plt.subplots(figsize=(15, 8))
    fig.tight_layout(pad=3.0)
    colors = ['red','blue','green']
    colors1 = ['pink', 'lightblue', 'lightgreen']

    for i,df in enumerate(l_reward_df):
        df["reward_std"]  = df["reward"].std()
        x = df['step'] / 1800
        y1 = df['reward_mean']
        y2 = df['reward']
        std = df['reward_std']
        ax.plot(x, y1, label= f'Episode Mean Reward C* = {C_star[i]}', color = colors[i], linestyle = 'solid', alpha = 0.2)
        y1_ma = y1.rolling(window=5, min_periods=1).mean()
        ax.plot(x, y1_ma, label= f'Moving Avg C* = {C_star[i]}', color = colors[i], linestyle = 'solid', linewidth=2)
        ax.plot(x, y2, label = f'Episode Reward C* = {C_star[i]}', color = colors1[i], linestyle = 'solid', alpha = 0.5)
        #ax.fill_between(x, y1 - std, y1 + std, alpha = 0.25, color = colors1[i])
        ax.set_xlabel('Episode')
        ax.set_ylabel('Reward')
        ax.set_xlim([0, 65])
    ax.legend(loc='upper left', fontsize='small')
    ax.grid()

    fig.suptitle(
        f'Reward and Mean Reward per episode Comparative Analysis',
        fontsize=12, fontweight='bold'
    )
    if save_path:
        plt.savefig(save_path, dpi = 300)
        print(f"Grafico salvato in: {save_path}")
    

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
        
        fig, ax = plt.subplots(nrows=3, ncols=2, figsize=(15, 12))
        fig.tight_layout(pad=4.0)

        # Subplot 1: Displacement (top-left)
        ax[0, 0].plot(last_data['time'], last_data['position'], label=r'Buoy displacement $\xi(t)$')
        ax[0, 0].plot(last_data['time'], last_data['wave_t'], label=r'Wave displacement $\zeta (t)$', color='#17becf',linestyle='dashed')
        ax[0, 0].set_xlabel(r'$t$ [s]')
        ax[0, 0].set_ylabel(r'Displacement [m]')
        ax[0, 0].legend(loc='lower right', fontsize='small')
        
        # Subplot 2: Velocity and Excitation Force (top-right)
        ax[0, 1].plot(last_data['time'], last_data['velocity'], label=r'Buoy velocity $\dot{\xi}(t)$', color='red')
        ax[0, 1].plot(last_data['time'], last_data['excitation_force'] * 10**-6, label=r'Excitation force $10^{-6} \times f_{e}(T)$', color='#1b9e77', linestyle='dashed')
        
        if 'u_latching' in last_data.columns:
            ax[0, 1].fill_between(last_data['time'], 0, 1,
                               where=(last_data['u_latching'] > 0.5), color='yellow', alpha=0.2, 
                               transform=ax[0, 1].get_xaxis_transform(), label='Latching Active')

        ax[0, 1].set_xlabel(r'$t$ [s]')
        ax[0, 1].set_ylabel("Velocity [m/s]\nvs\nWave force [MN]")
        ax[0, 1].legend(loc='lower right', fontsize='small')

        # Subplot 3: Instantaneous Power (middle-left)
        ax[1, 0].plot(data['time']/3600, data['power_inst'] * 10**-3, label=r'Inst. Power $10^{-3}$', color='orange')
        ax[1, 0].set_xlabel(r'$t$ [h]')
        ax[1, 0].set_ylabel("Inst. Power [kW]")
        ax[1, 0].legend(loc='lower right', fontsize='small')

        # Subplot 4: G_star (middle-right)
        ax[1, 1].plot(last_data['time'], last_data['G_star'], label=r'G_star', color='purple')
        ax[1, 1].set_xlabel(r'$t$ [s]')
        ax[1, 1].set_ylabel("G_star[]")
        ax[1, 1].legend(loc='lower right', fontsize='small')
        ax[1, 1].set_ylim([0, 11])

        # Subplot 5: Capture Width Ratio (bottom-left)
        ax[2, 0].plot(energy_data['time']/3600, energy_data['eta'], label=r'Capture Width Ratio', color='green')
        ax[2, 0].set_xlabel(r'$t$ [h]')
        ax[2, 0].set_ylabel("CWR")
        ax[2, 0].legend(loc='lower right', fontsize='small')
        
        # Elimino il sesto grafico che è vuoto
        fig.delaxes(ax[2, 1])

        if save_mode:
            plt.savefig(plot_path, dpi = 300)
            logger.info('\nSave simulation train results and plots...\n')


def plot_test(last_data, save_mode, plot_path):
        
        fig, ax = plt.subplots(nrows=3, ncols=1, figsize=(15, 12))
        fig.tight_layout(pad=4.0)

        # Subplot 1: Displacement (top)
        ax[0].plot(last_data['time'], last_data['position'], label=r'Buoy displacement $\xi(t)$')
        ax[0].plot(last_data['time'], last_data['wave_t'], label=r'Wave displacement $\zeta (t)$', color='#17becf',linestyle='dashed')
        ax[0].set_xlabel(r'$t$ [s]')
        ax[0].set_ylabel(r'Displacement [m]')
        ax[0].legend(loc='lower right', fontsize='small')
        
        # Subplot 2: Velocity and Excitation Force (middle)
        ax[1].plot(last_data['time'], last_data['velocity'], label=r'Buoy velocity $\dot{\xi}(t)$', color='red')
        ax[1].plot(last_data['time'], last_data['excitation_force'] * 10**-6, label=r'Excitation force $10^{-6} \times f_{e}(T)$', color='#1b9e77', linestyle='dashed')
        
        if 'u_latching' in last_data.columns:
            ax[1].fill_between(last_data['time'], 0, 1,
                               where=(last_data['u_latching'] > 0.5), color='yellow', alpha=0.2, 
                               transform=ax[1].get_xaxis_transform(), label='Latching Active')

        ax[1].set_xlabel(r'$t$ [s]')
        ax[1].set_ylabel("Velocity [m/s]\nvs\nWave force [MN]")
        ax[1].legend(loc='lower right', fontsize='small')

        # Subplot 3: Instantaneous Power (bottom)
        ax[2].plot(last_data['time'], last_data['power_inst'] * 10**-3, label=r'Inst. Power $10^{-3}$', color='orange')
        ax[2].set_xlabel(r'$t$ [s]')
        ax[2].set_ylabel("Power [kW]")
        ax[2].legend(loc='lower right', fontsize='small')

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


def add_cum_energy_abs(df):
    sea_state = df.iloc[0]['period_sea_state']
    energy_abs = df['energy_abs']
    
    cumulative_energy_abs = []
    e_abs = 0.0
    for e in energy_abs:
         e_abs += e
         cumulative_energy_abs.append(e_abs)
    
    df['cumulative_energy_abs'] = cumulative_energy_abs


    df.loc[-1] = [0.0, 0.0, 0.0, sea_state, 0.0]
    df.index = df.index + 1  # shifting index
    df = df.sort_index() 
    
    return df


def plot_comparative_energy_absorbed(src_path, ss, C_star, save_path = None):
    path_rl = []
    path_rlft = []
    path_base = []
    
    for s in ss:
         path_rl.append(resolve_ss_path(src_path, s, 'rl', ftype = 'energy', autocomplete = True))
         path_rlft.append(resolve_ss_path(src_path, s, 'rlft', ftype = 'energy', autocomplete = True))
         path_base.append(resolve_ss_path(src_path, s, 'base', ftype = 'energy', autocomplete = True))

    l_df_rlft = []
    l_df_rl = []
    l_df_base = []

    for i in range(len(path_rl)):
        df_rlft = pd.read_csv(path_rlft[i])
        df_rl = pd.read_csv(path_rl[i])
        df_base = pd.read_csv(path_base[i])

        df_rlft_mod = add_cum_energy_abs(df_rlft)
        df_rl_mod = add_cum_energy_abs(df_rl)
        df_base_mod = add_cum_energy_abs(df_base)

        l_df_rlft.append(df_rlft_mod)
        l_df_base.append(df_base_mod)
        l_df_rl.append(df_rl_mod)

    

    fig, ax = plt.subplots(figsize=(15, 8))
    fig.tight_layout(pad=3.0)
    label_lines = ['X','o','d']

    for s, l, df_base_mod, df_rl_mod, df_rlft_mod in zip(ss, label_lines, l_df_base, l_df_rl, l_df_rlft):
        
        ax.plot(df_base_mod['time'], df_base_mod['cumulative_energy_abs'] *10**-6, marker = l , markersize = 8, label=r'Cumulative Energy Absorbed - BASE_CONTROL', color = '#AAFF32', linestyle = 'solid')
        ax.plot(df_base_mod['time'], df_rl_mod['cumulative_energy_abs'] *10**-6, marker = l , markersize = 8, label=r'Cumulative Energy Absorbed - RL_CONTROL', color = '#13EAC9', linestyle = 'dashdot')
        ax.plot(df_base_mod['time'], df_rlft_mod['cumulative_energy_abs'] *10**-6, marker = l ,  markersize = 8, label=r'Cumulative Energy Absorbed - RLFT_CONTROL', color = '#0343DF', linestyle = 'dashed')
        ax.set_xlabel(r'$t$ [s]')
        ax.set_ylabel(r'Energy Absorbed[MJ]')
        ax.set_xlim([0 , 902])
        ax.legend(loc='upper left', fontsize='small')
    ax.grid()
    
    fig.suptitle(
        f'Cumulative Energy Absorbed Comparative Analysis, C* = {C_star}, Sea State = {ss[0]}',
        fontsize=12, fontweight='bold'
    )
    if save_path:
        plt.savefig(save_path, dpi = 300)
        print(f"Grafico salvato in: {save_path}")


def plot_combined_energy_absorbed(src_path,  C_star, ss = [0, 3, 5], save_path = None):
    path_rl = []
    path_rlft = []
    path_base = []
    
    for s in ss:
         path_rl.append(resolve_ss_path(src_path, s, 'rl', ftype = 'energy', autocomplete = True))
         path_rlft.append(resolve_ss_path(src_path, s, 'rlft', ftype = 'energy', autocomplete = True))
         path_base.append(resolve_ss_path(src_path, s, 'base', ftype = 'energy', autocomplete = True))

    l_df_rlft = []
    l_df_rl = []
    l_df_base = []

    for i in range(len(path_rl)):
        df_rlft = pd.read_csv(path_rlft[i])
        df_rl = pd.read_csv(path_rl[i])
        df_base = pd.read_csv(path_base[i])

        df_rlft_mod = add_cum_energy_abs(df_rlft)
        df_rl_mod = add_cum_energy_abs(df_rl)
        df_base_mod = add_cum_energy_abs(df_base)

        l_df_rlft.append(df_rlft_mod)
        l_df_base.append(df_base_mod)
        l_df_rl.append(df_rl_mod)

    

    fig, ax = plt.subplots(nrows = 1, ncols = 3, figsize=(15, 8))
    fig.tight_layout(pad=3.0)
    label_lines = ['X','o','d']
    i = 0
    max_y = np.max(df_rlft_mod['cumulative_energy_abs']) * 10**-6
    for s, l, df_base_mod, df_rl_mod, df_rlft_mod in zip(ss, label_lines, l_df_base, l_df_rl, l_df_rlft):
        
        ax[i].plot(df_base_mod['time'], df_base_mod['cumulative_energy_abs'] *10**-6, marker = l , markersize = 8, label=r'Cumulative Energy Absorbed - BASE_CONTROL', color = '#AAFF32', linestyle = 'solid')
        ax[i].plot(df_base_mod['time'], df_rl_mod['cumulative_energy_abs'] *10**-6, marker = l , markersize = 8, label=r'Cumulative Energy Absorbed - RL_CONTROL', color = '#13EAC9', linestyle = 'dashdot')
        ax[i].plot(df_base_mod['time'], df_rlft_mod['cumulative_energy_abs'] *10**-6, marker = l ,  markersize = 8, label=r'Cumulative Energy Absorbed - RLFT_CONTROL', color = '#0343DF', linestyle = 'dashed')
        ax[i].set_xlabel(r'$t$ [s]')
        if i == 0:
            ax[i].set_ylabel(r'Energy Absorbed[MJ]')
        ax[i].set_xlim([0 , 902])
        ax[i].set_ylim([0, max_y + 1])
        ax[i].legend(loc='upper left', fontsize='small')
        ax[i].grid()
        i+=1
    #ax.grid()
    
    fig.suptitle(
        f'Cumulative Energy Absorbed Comparative Analysis, C* = {C_star}',
        fontsize=12, fontweight='bold'
    )
    if save_path:
        plt.savefig(save_path, dpi = 300)
        print(f"Grafico salvato in: {save_path}")

def plot_comparative_buoy_motion(src_path, ss, C_star, save_path = None):
    path_rl = []
    path_rlft = []
    path_base = []
    
    for s in ss:
         path_rl.append(resolve_ss_path(src_path, s, 'rl', autocomplete = True))
         path_rlft.append(resolve_ss_path(src_path, s, 'rlft', autocomplete = True))
         path_base.append(resolve_ss_path(src_path, s, 'base', autocomplete = True))

    l_df_rl = []
    l_df_rlft = []
    l_df_base = []

    for i in range(len(path_rl)):
        df_rl = pd.read_csv(path_rl[i])
        df_rlft = pd.read_csv(path_rlft[i])
        df_base = pd.read_csv(path_base[i])

        df_rl_mod = df_rl.tail(2500)
        df_rlft_mod = df_rlft.tail(2500)
        df_base_mod = df_base.tail(2500)

        l_df_rl.append(df_rl_mod)
        l_df_rlft.append(df_rlft_mod)
        l_df_base.append(df_base_mod)

    for s, df_rl, df_rlft, df_base in zip(ss, l_df_rl, l_df_rlft, l_df_base):
    
        fig, ax = plt.subplots(nrows=2, ncols=1, figsize=(15, 8))
        fig.tight_layout(pad=3.0)

        # Subplot 1: Displacement (top-left)
        ax[0].plot(df_base['time'], df_base['position'], label=r'Buoy displacement $\xi(t)$ BASE_CONTROL', color = '#AAFF32', linestyle = 'solid')
        ax[0].plot(df_rlft['time'], df_rlft['position'], label=r'Buoy displacement $\xi(t)$ RLFT_CONTROL', color = '#0343DF', linestyle = 'solid')
        ax[0].plot(df_rl['time'], df_rl['position'], label=r'Buoy displacement $\xi(t)$ RL_CONTROL', color = '#13EAC9', linestyle = 'solid')
        ax[0].plot(df_rlft['time'], df_rlft['wave_t'], label=r'Wave displacement $\zeta (t)$', color='#FA8072',linestyle='dashed')
        ax[0].set_xlabel(r'$t$ [s]')
        ax[0].set_ylabel(r'Displacement [m]')
        ax[0].legend(loc='lower right', fontsize='small')
        ax[0].grid()
            
        # Subplot 2: Velocity and Excitation Force (top-right)
        ax[1].plot(df_base['time'], df_base['velocity'], label=r'Buoy velocity $\dot{\xi}(t)$ BASE_CONTROL', color='#AAFF32', linestyle = 'solid')
        ax[1].plot(df_rlft['time'], df_rlft['velocity'], label=r'Buoy velocity $\dot{\xi}(t)$ RLFT_CONTROL', color='#0343DF', linestyle = 'solid')
        ax[1].plot(df_rl['time'], df_rl['velocity'], label=r'Buoy velocity $\dot{\xi}(t)$ RL_CONTROL', color='#13EAC9', linestyle = 'solid')
        ax[1].plot(df_rlft['time'], df_rlft['excitation_force'] * 10**-6, label=r'Excitation force $10^{-6} \times f_{e}(T)$', color='#FA8072', linestyle='dashed')
        ax[1].set_xlabel(r'$t$ [s]')
        ax[1].set_ylabel("Velocity [m/s]\nvs\nWave force [MN]")
        ax[1].legend(loc='lower right', fontsize='small')
        ax[1].grid()

    fig.suptitle(
        f'Buoy Motion Comparative Analysis, C* = {C_star}, Sea State = {ss[0]}',
        fontsize=12, fontweight='bold'
    )
    
    if save_path:
        plt.savefig(save_path, dpi = 300)
        print(f"Grafico salvato in: {save_path}")


def plot_comparative_buoy_control(src_path, ss, C_star, save_path = None):
    path_rl = []
    path_rlft = []
    path_base = []
    
    for s in ss:
         path_rl.append(resolve_ss_path(src_path, s, 'rl', autocomplete = True))
         path_rlft.append(resolve_ss_path(src_path, s, 'rlft', autocomplete = True))
         path_base.append(resolve_ss_path(src_path, s, 'base', autocomplete = True))

    l_df_rl = []
    l_df_rlft = []
    l_df_base = []

    for i in range(len(path_rl)):
        df_rl = pd.read_csv(path_rl[i])
        df_rlft = pd.read_csv(path_rlft[i])
        df_base = pd.read_csv(path_base[i])

        df_rl_mod = df_rl.tail(2500)
        df_rlft_mod = df_rlft.tail(2500)
        df_base_mod = df_base.tail(2500)

        l_df_rl.append(df_rl_mod)
        l_df_rlft.append(df_rlft_mod)
        l_df_base.append(df_base_mod)

    for s, df_rl, df_rlft, df_base in zip(ss, l_df_rl, l_df_rlft, l_df_base):
    
        fig, ax = plt.subplots(nrows=3, ncols=1, figsize=(15, 8))
        fig.tight_layout(pad=3.0)

        ax[0].plot(df_rlft['time'], df_rlft['velocity'], label=r'Buoy velocity $\dot{\xi}(t)$ RLFT_CONTROL', color='#0343DF', linestyle = 'solid')
        ax[0].plot(df_rl['time'], df_rl['velocity'], label=r'Buoy velocity $\dot{\xi}(t)$ RL_CONTROL', color='#13EAC9', linestyle = 'solid')
        #ax[0].plot(df_base['time'], df_base['velocity'], label=r'Buoy velocity $\dot{\xi}(t)$ BASE_CONTROL', color='#AAFF32', linestyle = 'solid')
        ax[0].plot(df_rlft['time'], df_rlft['excitation_force'] * 10**-6, label=r'Excitation force $10^{-6} \times f_{e}(T)$', color='#FA8072', linestyle='dashed')
        ax[0].set_xlabel(r'$t$ [s]')
        ax[0].set_ylabel(r'$u(t)$ [m]')
        ax[0].set_ylabel("Velocity [m/s]\nvs\nWave force [MN]")
        ax[0].legend(loc='lower right', fontsize='small')
        ax[0].grid()
        

        ax[1].plot(df_rlft['time'], df_rlft['u_latching'], label=r'Buoy control latching on-off $u(t)$ RLFT_CONTROL', color = '#0343DF', linestyle = 'solid')
        ax[1].plot(df_rl['time'], df_rl['u_latching'], label=r'Buoy control latching on-off $u(t)$ RL_CONTROL', color = '#13EAC9', linestyle = 'solid')
        #ax[1].plot(df_base['time'], df_base['u_latching'], label=r'Buoy control latching on-off $u(t)$ BASE_CONTROL', color = '#AAFF32', linestyle = 'solid')
        ax[1].set_xlabel(r'$t$ [s]')
        ax[1].set_ylim([0, 1.05])
        ax[1].set_ylabel(r'$u(t)$ [m]')
        ax[1].legend(loc='lower right', fontsize='small')
        ax[1].grid()
            
        ax[2].plot(df_rlft['time'], df_rlft['G_star'], label=r'Buoy control G* RLFT_CONTROL', color='#0343DF', linestyle = 'solid')
        ax[2].plot(df_rl['time'], df_rl['G_star'], label=r'Buoy control G* RL_CONTROL', color='#13EAC9', linestyle = 'solid')
        #ax[2].plot(df_base['time'], df_base['G_star'], label=r'Buoy control G* BASE_CONTROL', color='#AAFF32', linestyle = 'solid')
        ax[2].set_xlabel(r'$t$ [s]')
        ax[2].set_ylim([0, 10.5])
        ax[2].set_ylabel("G*")
        ax[2].legend(loc='lower right', fontsize='small')
        ax[2].grid()

    fig.suptitle(
        f'Buoy Latching Control Comparative Analysis, C* = {C_star}, Sea State = {ss[0]}',
        fontsize=12, fontweight='bold'
    )
    
    if save_path:
        plt.savefig(save_path, dpi = 300)
        print(f"Grafico salvato in: {save_path}")


def resolve_ss_path(path, ss, method, ftype = 'motion', autocomplete = False):
    p_table = [9.0, 9.5, 10.0, 10.5, 11.0, 11.5, 12.0, 12.5, 13.0]
    hw_table = [0.8, 1.2, 1.6, 2.0, 2.4, 2.9, 3.4, 4.0, 4.5]
    p = p_table[ss]
    hw = hw_table[ss]

    if autocomplete:

        if ftype == 'motion':
            rel_path = f'sea_state_{hw}_{p}/simulation_latching_{method}_900s_05s_{hw}_{p}_irregular.csv'
        else:
            rel_path = f'sea_state_{hw}_{p}/simulation_latching_{method}_900s_05s_{hw}_{p}_irregular_energy_absorbed.csv'

        path = os.path.join(path, rel_path)
    
    
    return path


if __name__ == '__main__':
    
    regular = False
    C_star = 0.5
    sea_states = [0,3,5]
    p_table = [9.0, 9.5, 10.0, 10.5, 11.0, 11.5, 12.0, 12.5, 13.0]
    hw_table = [0.8, 1.2, 1.6, 2.0, 2.4, 2.9, 3.4, 4.0, 4.5]


    

    for s in sea_states:
        plot_energy_abs_bar_charts(src_path = './results/final/data/energy_results_irregular_waves.csv', ss = s, save_path = f'./results/final/plot/energy_results_irregular_ss{s}.png')
        plot_power_bar_charts(src_path = './results/final/data/energy_results_irregular_waves.csv', ss = s, save_path = f'./results/final/plot/power_results_irregular_ss{s}.png')
        plot_comparative_buoy_motion(src_path = './results/test/data/irregular/', ss = [s], C_star = C_star, save_path = f'./results/final/plot/buoy_motion_comparative_ss{s}_Cstar{C_star}.png')
        plot_comparative_energy_absorbed(src_path = './results/test/data/irregular/', ss = [s], C_star = C_star, save_path = f'./results/final/plot/cumulative_energy_comparative_ss{s}_Cstar{C_star}.png')
        plot_comparative_buoy_control(src_path = './results/test/data/irregular/', ss = [s], C_star = C_star,  save_path = f'./results/final/plot/latching_control_comparative_ss{s}_Cstar{C_star}.png')
    
    plot_combined_energy_absorbed(src_path = './results/test/data/irregular/', C_star = C_star, save_path = f'./results/final/plot/cumulative_energy_combined_Cstar{C_star}.png')
    plot_comparative_rewards(src_path = './results/test/data/irregular/sea_state_mixed/', model = 'normal', save_path = f'./results/final/plot/reward_comparative_rl.png')
    plot_comparative_rewards(src_path = './results/test/data/irregular/sea_state_2.4_11.0/', model = 'ft', save_path = f'./results/final/plot/reward_comparative_rlft.png')
    
    plt.show()