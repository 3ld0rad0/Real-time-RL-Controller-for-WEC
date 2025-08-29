import numpy as np
import json
import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from simulation.Oscillator import Oscillator

import numpy as np
import json
import logging

# Logger setup
logging.basicConfig(
    level=logging.INFO,  # Cambia a DEBUG se vuoi più dettagli
    #format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def warmup(warmup_time, init_values, file_path='./utils/warmup.json', n_sim=100, adaptive_sampling=True):
    period, Hw, C, K, G_STAR, regular, warmup_time, control_mode, d_t, nSS = init_values
    oscillator = Oscillator(C, K, G_STAR, regular, warmup_time, control_mode, d_t, nSS, seed_spectrum = 17)

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
        #random_ptod_v = [oscillator.get_opt_damping_pto() * 0.2,oscillator.get_opt_damping_pto() * 0.3, oscillator.get_opt_damping_pto() * 0.4, oscillator.get_opt_damping_pto() * 0.5]
        random_ptod_v = [oscillator.get_damping_c_star(0.1), oscillator.get_damping_c_star(0.2), oscillator.get_damping_c_star(0.3), oscillator.get_damping_c_star(0.4), oscillator.get_damping_c_star(0.5)]
        random_ptos_v = [0.0, 0.0, 0.0, 0.0]

    v_arr = []
    x_arr = []
    fe_t_arr = []

    for re_d, re_s in zip(random_ptod_v, random_ptos_v):
        oscillator.set_fpto(re_d, re_s)
        n_points = 500 if regular else 1000
        t_span = (0, warmup_time) if regular else (0, warmup_time * 2)
        t_eval = np.linspace(t_span[0], t_span[1], n_points)
        oscillator.solve(t_span=t_span, t_eval=t_eval)

        x = np.abs(oscillator.get_position())
        v = np.abs(oscillator.get_speed())
        fe_t = np.abs(oscillator.get_fet())

        x_arr.append(np.max(x))
        v_arr.append(np.max(v))
        fe_t_arr.append(np.max(fe_t))

    x_max = np.max(x_arr)
    v_max = np.max(v_arr)
    fe_t_max = np.max(fe_t_arr)

    if regular:

        simulation_data = {
            'x_max': float(x_max) + 1.0,
            'v_max': float(v_max) + 1.0,
            'fet_max': float(fe_t_max),
            'opt_damping': opt_fpto_damp,
            'opt_stifness': opt_fpto_stif,
        }

    else:
        simulation_data = {
            'x_max': float(x_max) + 0.5,
            'v_max': float(v_max) + 0.5,
            'fet_max': float(fe_t_max),
            'opt_damping' : opt_fpto_damp
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
    
    with open('./utils/config.json', 'r') as f:
        config = json.load(f)
    

    C = config['init_C']
    K = config['init_K']
    G_STAR = config['init_G_star']
    regular = config['regular']
    reg_lbl = 'regular' if regular else 'irregular'
    warmup_time = config['warmup_time']
    control_mode = 'linear'
    d_t_oscillator = config['d_t']


    # per ogni coppia (period, Hw) calcola i valori di warmup
    ss_period = [9.0, 9.5, 10.0, 10.5, 11.0, 11.5, 12.0, 12.5, 13.0]
    ss_wh = [0.8, 1.2, 1.6, 2.0, 2.4, 2.9, 3.4, 4.0, 4.5]
    
    for i in range(len(ss_period)):

        nSS = i
        p = ss_period[nSS]
        hw = ss_wh[nSS]

        warmup(warmup_time= warmup_time, init_values= (p, hw, C, K, G_STAR, regular, warmup_time, control_mode, d_t_oscillator, nSS))
        logger.info(f'Load warmup values for {reg_lbl} wave, with period : {p} and wave height : {hw}')