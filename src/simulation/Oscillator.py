"""DEFINE THE WEC OSCILLATOR CLASS AND ITS DYNAMICS"""


import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from src.simulation.PM_Spectrum import PM_Spectrum
import numpy as np
from scipy.integrate import solve_ivp, trapezoid
from scipy.interpolate import interp1d
import matplotlib.pyplot as plt
import src.utils.mpl_utils as mut
from src.utils.mpl_utils import linecolors
mut.config_plots()


class Oscillator:
    # Moved static ka_table to class level to avoid RAM reallocation on every instance
    _ka_table = np.array([
        #ka    #A*(ka) #B*(ka)
        [0,    0.8310, 0],
        [0.05, 0.8764, 0.1036],
        [0.1,  0.8627, 0.1816],
        [0.2,  0.7938, 0.2793],
        [0.3,  0.7157, 0.3254],
        [0.4,  0.6452, 0.3410],
        [0.5,  0.5861, 0.3391],
        [0.6,  0.5381, 0.3271],
        [0.7,  0.4999, 0.3098],
        [0.8,  0.4698, 0.2899],
        [0.9,  0.4464, 0.2691],
        [1.0,  0.4284, 0.2484],
        [1.2,  0.4047, 0.2096],
        [1.4,  0.3924, 0.1756],
        [1.6,  0.3871, 0.1469],
        [1.8,  0.3864, 0.1229],
        [2.0,  0.3884, 0.1031],
        [2.5,  0.3988, 0.0674],
        [3.0,  0.4111, 0.0452],
        [4.0,  0.4322, 0.0219],
        [5.0,  0.4471, 0.0116],
        [6.0,  0.4574, 0.0066],
        [7.0,  0.4647, 0.0040],
        [8.0,  0.4700, 0.0026],
        [9.0,  0.4740, 0.0017],
        [10.0, 0.4771, 0.0012],
        [np.inf, 0.5, 0]
    ])

    def __init__(self, C, C_star, K, G_star, regular, t_final, control_mode, d_t, sea_state, seed_spectrum):
        self._regular = regular
        self._ss_period = [9.0, 9.5, 10.0, 10.5, 11.0, 11.5, 12.0, 12.5, 13.0]
        self._ss_wh = [0.8, 1.2, 1.6, 2.0, 2.4, 2.9, 3.4, 4.0, 4.5]
        self._sea_state = sea_state
        self._control_mode = control_mode
        self._seed_spectrum = seed_spectrum

        self._r = 5
        self._S_cs = np.pi * self._r**2
        self._volume = 2/3 * np.pi * self._r**3
        self._rho = 1025
        self._g = 9.81
        self._m = self._rho * self._volume 

        self._G_star = G_star
        self._setup_hydrodynamics()
        
        self._C = C
        self._K = K
        
        ######################## Latching control ########################
        if self._control_mode == 'latching':
            self._C_star = C_star
            self._C = self._C_star * self._r**2.5 * self._rho * self._g**0.5
            self._K = 0

        self._u = 0.0 ## control inactive
        
        ##################################################################
        self._t_final = t_final
        self._d_t = d_t
        self._eval_window_len = (self._d_t * 100) // 2

        # Bind the integration system dynamically to avoid branch checks (if) in solve loop
        if self._regular:
            if self._control_mode == 'linear':
                self._system = self._system_regular_linear
            else:
                self._system = self._system_regular_latching
        else:
            if self._control_mode == 'linear':
                self._system = self._system_irregular_linear
            else:
                self._system = self._system_irregular_latching


    def _setup_hydrodynamics(self):
        """Unified method to compute constants to avoid duplicating code in init and update"""
        self._T = self._ss_period[self._sea_state]
        self._Hw = self._ss_wh[self._sea_state]
        self._wave_velocity = self._g * self._T / (2 * np.pi)
        self._wave_l = self._wave_velocity * self._T
        self._k = 2 * np.pi / self._wave_l
        self._ka = self._k * self._r

        self._A_star_interp = interp1d(Oscillator._ka_table[:, 0], Oscillator._ka_table[:, 1], kind='linear', fill_value="extrapolate")
        self._B_star_interp = interp1d(Oscillator._ka_table[:, 0], Oscillator._ka_table[:, 2], kind='linear', fill_value="extrapolate")
        self._A_star = Oscillator._ka_table[-1, 1]
        self._B_star = self._B_star_interp(self._ka)

        if not self._regular:
            ######################## IRREGULAR CASE ######################
            self._spectrum = self._init_irregular_parameters(self._sea_state, self._seed_spectrum)
            
            if self._spectrum is not None:
                self._N_freq = len(self._spectrum[0])
                self._amps = self._spectrum[0]         # A_ω
                self._omega = self._spectrum[1]        # ω
                self._phases = self._spectrum[2]       # φ
                B_array = self._B_star * (2/3 * np.pi * self._r**3 * self._rho * self._omega)
                weights = self._amps**2
                self._B = np.average(B_array, weights=weights)
                self._Lmbd = np.sqrt((2 * self._rho * self._g**3 * self._B) / (self._omega**3))
                coeff = (self._rho * self._g**2) / (64 * np.pi) * (10**-3)
                self._energy_wave = (coeff * self._Hw**2 * self._T) * (2 * self._r) * (10**3)
        
        else:
            ######################## REGULAR CASE ######################
            self._A_star = self._A_star_interp(self._ka)
            self._omega = 2 * np.pi / self._T
            self._B = self._B_star * (2/3 * np.pi * self._r**3 * self._rho * self._omega)
            self._Lmbd = np.sqrt((2 * self._rho * self._g**3 * self._B) / (self._omega**3))
            coeff = (self._rho * self._g**2) / (8 * np.pi) * (10**-3)
            self._energy_wave = (coeff * self._Hw**2 * self._T) * (2 * self._r) * (10**3)
        
        self._m_add = self._A_star * (2/3 * np.pi * self._r**3 * self._rho)
        self._m_tot = self._m + self._m_add
        self._hydro_stiffness = self._rho * self._g * self._S_cs
        self._G = self._G_star * self._m_tot

    
    def _init_irregular_parameters(self, nSS, seed):
        pm = PM_Spectrum(seed)
        nω = 256  # Number of frequency components
        ω_min = 2.0 * np.pi / 18.0
        ω_max = 2.0 * np.pi / 4.0
        Te, Hs, A_ω, ω, φ = pm.Amp_Phase(nSS, nω, ω_min, ω_max)
        spectral_input = (A_ω, ω, φ)
        return spectral_input


    def _fe_t_irregular(self, t):
        """Calcola la forza di eccitazione per onde irregolari"""
        return np.sum(self._Lmbd * self._amps * np.cos(self._omega * t + self._phases))

    def _wave_elevation_irregular(self, t):
        """Calcola l'elevazione dell'onda per onde irregolari"""
        return np.sum(self._amps * np.cos(self._omega * t + self._phases))

    def _calculate_energy_absorbed(self):
        # Fully Vectorized Math
        v_sq = np.square(self._v)
        self._pow_inst = v_sq * self._C
        self._energy_abs = trapezoid(v_sq, self._t) * self._C
    
    # ------------------ SEPARATED ODE SYSTEMS FOR MAXIMUM SOLVER SPEED -------------- #
    def _system_regular_linear(self, t, X):
        x1, x2 = X
        fe_t = self._Lmbd * self._Hw * np.cos(self._omega * t)
        dx2_dt = (- (self._B + self._C) * x2 - (self._hydro_stiffness + self._K) * x1 + fe_t ) / self._m_tot
        return [x2, dx2_dt]

    def _system_regular_latching(self, t, X):
        x1, x2 = X
        fe_t = self._Lmbd * self._Hw * np.cos(self._omega * t)
        dx2_dt = (- (self._B + self._C + (self._G * self._u)) * x2 - (self._hydro_stiffness + self._K) * x1 + fe_t ) / self._m_tot
        return [x2, dx2_dt]

    def _system_irregular_linear(self, t, X):
        x1, x2 = X
        fe_t = self._fe_t_irregular(t)
        dx2_dt = (- (self._B + self._C) * x2 - (self._hydro_stiffness + self._K) * x1 + fe_t ) / self._m_tot
        return [x2, dx2_dt]

    def _system_irregular_latching(self, t, X):
        x1, x2 = X
        fe_t = self._fe_t_irregular(t)
        dx2_dt = (- (self._B + self._C + (self._G * self._u)) * x2 - (self._hydro_stiffness + self._K) * x1 + fe_t ) / self._m_tot
        return [x2, dx2_dt]
    # -------------------------------------------------------------------------------- #

    def solve(self, t_span=None, t_eval=None, initial_conditions=(0.0, 0.0), method='RK45'):
        if t_span is None:
            t_span = (0, self._t_final)
        
        # Solve the differential equation using solve_ivp
        if t_eval is None:
            step = int(self._eval_window_len)
            t_eval = np.linspace(t_span[0], t_span[1], step)  # Default time evaluation
        
        sol = solve_ivp(self._system, t_span, initial_conditions, t_eval=t_eval, method=method)
        self._t = sol.t
        self._x = sol.y[0]  # Position
        self._v = sol.y[1]  # Velocity

        # Vectorized Generation of Evaluation Arrays
        if self._regular:
            self._fe_t = self._Lmbd * self._Hw * np.cos(self._omega * self._t)
            self._wave_t = self._Hw * np.cos(self._omega * self._t)
        else:
            omega_t = self._omega[:, np.newaxis] * self._t[np.newaxis, :]
            cos_term = np.cos(omega_t + self._phases[:, np.newaxis])
            self._fe_t = np.sum((self._Lmbd * self._amps)[:, np.newaxis] * cos_term, axis=0)
            self._wave_t = np.sum(self._amps[:, np.newaxis] * cos_term, axis=0)
        
        self._calculate_energy_absorbed()

        return self._t, self._x, self._v, self._fe_t
    

    ## Nel caso in cui siano previsti valori variabili nella simulazione ##
    def update_sea_state(self, sea_state):
        self.set_sea_state(sea_state)
        self._setup_hydrodynamics()

    def get_sea_state(self):
        return self._sea_state
    
    def set_sea_state(self, ss):
        self._sea_state = ss
        self.set_period(self._ss_period[ss])
        self.set_wave_height(self._ss_wh[ss])
    
    def get_t_final(self):
        return self._t_final
    
    def get_d_t(self):
        return self._d_t

    def set_fpto(self, C, K):
        self._C = C
        self._K = K

    def set_G_star(self, g_star):
        self._G_star = g_star
        self._G = self._G_star * self._m_tot

    def get_G_star(self):
        return self._G_star
    
    def get_G(self):
        return self._G
    
    def get_C(self):
        return self._C
    
    def get_K(self):
        return self._K

    def get_latching(self):
        return self._u
    
    def set_latching(self, u):
        self._u = u

    def get_fpto_damping(self):
        return self._C
    
    def get_fpto_stifness(self):
        return self._K
    
    def get_speed(self):
        return self._v
    
    def get_position(self):
        return self._x
    
    def get_fet(self):
        return self._fe_t
    
    def get_timevector(self):
        return self._t
    
    def get_wavet(self):
        return self._wave_t
    
    def get_Lambda(self):
        return self._Lmbd
    
    def get_omega(self):
        return self._omega
    
    def get_omega_zero(self):
        return np.sqrt((self._hydro_stiffness + self._K) / self._m_tot)
    
    def get_period_zero(self):
        return 2 * np.pi / self.get_omega_zero()

    def get_added_mass(self):
        return self._m_add
    
    def get_ktot(self):
        return self._rho * self._S_cs * self._g * self._K
    
    def get_opt_stifness_pto(self):
        if self._regular:
            return self._omega**2 * self._m_tot - self._hydro_stiffness
        else:
            # Per onde irregolari, calcola la stiffness ottimale come media pesata
            weights = self._amps**2
            return np.average(self._omega**2 * self._m_tot - self._hydro_stiffness, weights=weights)
    
    def get_opt_damping_pto(self):
        if self._regular:
            return self._B_star * 2/3 * np.pi * self._r**3 * self._rho * self._omega
        else:
            # Per onde irregolari, calcola il damping ottimale come media pesata
            weights = self._amps**2
            return self._B_star * np.average(2/3 * np.pi * self._r**3 * self._rho * self._omega, weights=weights)

    def get_period(self):
        return self._T
    
    def set_period(self, period):
        self._T = period
    
    def get_wave_height(self):
        return self._Hw
    
    def set_wave_height(self, Hw):
        self._Hw = Hw

    def get_eval_len(self):
        return int(self._eval_window_len)
    
    def get_wmode(self):
        return self._regular
    
    def get_pow_inst(self):
        return self._pow_inst
    
    def get_energy(self):
        return self._energy_abs
    
    def get_wave_energy(self):
        return self._energy_wave
    
    def get_control_mode(self):
        return self._control_mode
    
    def get_damping_c_star(self, C_star):
        return C_star * self._r**2.5 * self._rho * self._g**0.5

    def get_table_period(self):
        return self._ss_period

    def plot(self):
        # Plot the results
        fig, ax = plt.subplots(nrows=2, ncols=1, figsize=(10, 6))
        fig.tight_layout(pad=3.0)

        plt.subplot(2, 1, 1)
        plt.plot(self._t, self._x, label=r'Buoy displacement $\xi(t)$')
        plt.plot(self._t, self._wave_t, label=r'Wave displacement $\zeta (t)$', color='#17becf')
        plt.xlabel(r'$t$ [s]')
        plt.ylabel(r'Displacement [m]')
        plt.legend(loc='lower right', fontsize='small')
        plt.ylim(-4, 4)
        plt.grid()

        plt.subplot(2, 1, 2)
        plt.plot(self._t, self._v, label=r'Buoy velocity $\dot{\xi}(t)$', color='red')
        plt.plot(self._t, self._fe_t * 10**-6, label=r'Excitation force $10^{-6} \times f_{e}(T)$', color='#1b9e77')
        plt.xlabel(r'$t$ [s]')
        plt.ylabel("Velocity [m/s]\nvs\n Wave force [MN]")
        plt.legend(loc='lower right', fontsize='small')
        plt.ylim(-4, 4)
        plt.grid()
        plt.tight_layout()


if __name__ == '__main__':
    
    nSS = 5
    C = 0
    K = 0
    G_STAR = 5
    C_STAR = 0.1
    regular = 0
    sim_time = 60
    control_mode = 'latching'
    d_t = 0.5
    seed_spectrum = 123

    oscillator = Oscillator(C, C_STAR, K, G_STAR, regular, sim_time, control_mode, d_t, nSS, seed_spectrum)
    oscillator.solve(t_eval=np.linspace(0, sim_time, 1000))
    oscillator.get_period_zero()
    oscillator.plot()
    plt.show()