import numpy as np
import json
import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from simulation.Oscillator import Oscillator
from simulation.PM_Spectrum import PM_Spectrum
import random

import numpy as np
import json

def warmup(warmup_time, init_values, file_path='./warmup.json', n_sim=100, adaptive_sampling=True):
    period, Hw, C, K, G_STAR, regular, sim_time, control_mode, d_t, spectral_input = init_values
    oscillator = Oscillator(period, Hw, C, K, G_STAR, regular, sim_time, control_mode, d_t, spectral_input)

    opt_fpto_damp = oscillator.get_opt_damping_pto()
    opt_fpto_stif = oscillator.get_opt_stifness_pto()

    if regular:
        if adaptive_sampling:
            critical_samples = int(n_sim * 0.7)
            edge_samples = n_sim - critical_samples

            damp_critical = np.random.uniform(0.7 * opt_fpto_damp, opt_fpto_damp, size=critical_samples)
            damp_edge = np.random.uniform(0, 0.3 * opt_fpto_damp, size=edge_samples)

            if opt_fpto_stif >= 0:
                stif_critical = np.random.uniform(0.7 * opt_fpto_stif, opt_fpto_stif, size=critical_samples)
                stif_edge = np.random.uniform(-opt_fpto_stif, -0.7 * opt_fpto_stif, size=edge_samples)
            else:
                stif_critical = np.random.uniform(opt_fpto_stif, 0.7 * opt_fpto_stif, size=critical_samples)
                stif_edge = np.random.uniform(-0.7 * -opt_fpto_stif, -opt_fpto_stif, size=edge_samples)

            random_ptod_v = np.concatenate([damp_critical, damp_edge])
            random_ptos_v = np.concatenate([stif_critical, stif_edge])
        else:
            random_ptod_v = np.random.uniform(0, opt_fpto_damp, size=n_sim)
            random_ptos_v = np.random.uniform(opt_fpto_stif, -opt_fpto_stif, size=n_sim)
    else:
        # Fisso per onde irregolari
        random_ptod_v = [oscillator.get_B() * 0.2,oscillator.get_B() * 0.3, oscillator.get_B() * 0.4, oscillator.get_B() * 0.5]
        random_ptos_v = [0.0, 0.0, 0.0, 0.0]

    v_arr = []
    x_arr = []

    for re_d, re_s in zip(random_ptod_v, random_ptos_v):
        oscillator.set_fpto(re_d, re_s)
        n_points = 500 if regular else 1000
        t_span = (0, warmup_time) if regular else (0, warmup_time * 2)
        t_eval = np.linspace(t_span[0], t_span[1], n_points)
        oscillator.solve(t_span=t_span, t_eval=t_eval)

        x = np.abs(oscillator.get_position())
        v = np.abs(oscillator.get_speed())

        x_arr.append(np.max(x))
        v_arr.append(np.max(v))

    x_max = np.max(x_arr)
    v_max = np.max(v_arr)

    if regular:

        simulation_data = {
            'x_max': float(x_max) + 2.0,
            'v_max': float(v_max) + 2.0,
            'opt_damping': opt_fpto_damp,
            'opt_stifness': opt_fpto_stif
        }

    else:
        simulation_data = {
            'x_max': float(x_max) + 2.0,
            'v_max': float(v_max) + 2.0
        }


    try:
        with open(file_path, 'r') as f:
            results = json.load(f)
    except FileNotFoundError:
        results = {'regular': {}, 'irregular': {}}

    wave_key = f"T_{period}_Hw_{Hw}"
    main_key = 'regular' if regular else 'irregular'
    results[main_key][wave_key] = simulation_data

    with open(file_path, 'w') as f:
        json.dump(results, f, indent=2)



if __name__ == "__main__":
    
    with open('./config.json', 'r') as f:
        config = json.load(f)
    

    C = config['init_C']
    K = config['init_K']
    G_STAR = config['init_G_star']
    sim_time = config['sim_time']
    regular = config['regular']
    warmup_time = config['warmup_time']
    period_b = config['period_table']
    hw_b = config['wave_height_table']
    #control_mode = config['control_mode']
    control_mode = 'linear'
    d_t_oscillator = config['d_t']

    # vals_period = list(range(period_b[0], period_b[1] + 1))
    # vals_hw = []
    # val = hw_b[0]
    # d_t = 0.5
    
    # while val <= hw_b[1]:
    #     vals_hw.append(round(val, 1))
    #     val += d_t

    # xx, yy = np.meshgrid(vals_period,vals_hw)
    # tuple = []
    
    # for i in range (len(xx)):
    #     for j in range (len(xx[0])):
    #          tuple.append((xx[i,j], yy[i,j]))

    ss_values = []

    for i,j in zip (period_b, hw_b):
        ss_values.append((i,j))
    
    spectral_input = None

    # per ogni coppia (period, Hw) calcola i valori di warmup
    counter = 0
    
    for t in ss_values:
        p = t[0]
        hw = t[1]

        if not regular:
            pm = PM_Spectrum()
            nSS = counter
            nω = 100
            ω_min = 0.3
            ω_max = 2.5
            Te, Hs, A_ω, ω, φ = pm.Amp_Phase(nSS, nω, ω_min, ω_max)
            spectral_input = (A_ω, ω, φ)

        warmup(warmup_time= warmup_time, init_values= (p, hw, C, K, G_STAR, regular, sim_time, control_mode, d_t_oscillator, spectral_input))
        print(f'Load warmup values for period : {p} and wave height : {hw}')

        counter += 1