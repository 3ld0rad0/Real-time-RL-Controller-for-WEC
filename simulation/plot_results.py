import matplotlib.pyplot as plt
import pandas as pd
import os
import json


def plot_force(t, force, label, color):
    plt.figure(figsize=(10, 4))
    plt.plot(t, force, label=label, color=color)
    plt.xlabel(r'$t$ [s]')
    plt.ylabel("Force [MN]")
    plt.legend(loc='lower right', fontsize='small')
    plt.grid(True)
    plt.tight_layout()

def plot_fpto_damping(t, fpto_d):
    plot_force(t, fpto_d, label='Fpto Damping', color='orange')


def plot_fpto_stiffness(t, fpto_s):
    plot_force(t, fpto_s, label='Fpto Stiffness', color='purple')


def plot_fpto_components(t, damping, stiffness, threshold = None):
    plt.figure(figsize=(10, 5))
    
    # Curve di damping e stiffness
    plt.plot(t, damping, label='Fpto Damping', color='orange')
    plt.plot(t, stiffness, label='Fpto Stiffness', color='purple')
    
    # Linea di soglia
    if threshold is not None:
        plt.axhline(y=threshold[0], color='orange', linestyle='--', linewidth=1.5, label=f'Damping_opt = {threshold[0]:.2f} MN')
        plt.axhline(y=threshold[1], color='purple', linestyle='--', linewidth=1.5, label=f'Stifness_opt = {threshold[1]:.2f} MN')

    plt.xlabel(r'$t$ [s]')
    plt.ylabel("Force [MN]")
    plt.title("Fpto Damping and Stiffness Over Time")
    plt.legend(loc='lower right', fontsize='small')
    plt.grid(True)
    plt.tight_layout()


def plot_wave_buoy_data(data):
    # TODO: implement this function based on available columns in `data`
    pass


def plot_avg_power(data):
    # TODO: implement this function
    pass


def plot_inst_power(t, pow_inst):
    plt.figure(figsize=(10, 4))
    plt.plot(t, pow_inst*10e-6, label="Instant Power", color='green')
    plt.xlabel(r'$t$ [s]')
    plt.ylabel("Force [MW]")
    plt.legend(loc='lower right', fontsize='small')
    plt.grid(True)
    plt.tight_layout()


if __name__ == "__main__":

    with open("./config.json", "r") as f:
        config = json.load(f)
    file_path = config['results_path']

    file_path = os.path.join(file_path+'simulation_7200_2_9_regular.csv')

    if os.path.exists(file_path):
        df = pd.read_csv(file_path)

        if {'time', 'damping_fpto', 'stifness_fpto'}.issubset(df.columns):
            #plot_fpto_damping(df['time'], df['damping_fpto'])
            #plot_fpto_stiffness(df['time'], df['stifness_fpto'])
            plot_fpto_components(df['time'], df['damping_fpto'], df['stifness_fpto'], threshold= (config["opt_damping"], config["opt_stifness"]))
            plot_inst_power(df['time'], df['power_inst'])
            plt.show()
        else:
            print("Errore: Il file non contiene tutte le colonne necessarie.")
    else:
        print(f"File non trovato: {file_path}")
