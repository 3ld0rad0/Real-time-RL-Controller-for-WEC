"""DEFINE THE WEC OSCILLATOR CLASS AND ITS DYNAMICS"""


import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from simulation.PM_Spectrum import PM_Spectrum
import numpy as np
from scipy.integrate import solve_ivp, trapezoid
from scipy.interpolate import interp1d
import matplotlib.pyplot as plt
import utils.mpl_utils as mut
from  utils.mpl_utils import linecolors
mut.config_plots()


class Oscillator:
    # Moved static ka_table to class level to avoid RAM reallocation on every instance
    ka_table = np.array([
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
        self.regular = regular
        self.ss_period = [9.0, 9.5, 10.0, 10.5, 11.0, 11.5, 12.0, 12.5, 13.0]
        self.ss_wh = [0.8, 1.2, 1.6, 2.0, 2.4, 2.9, 3.4, 4.0, 4.5]
        self.sea_state = sea_state
        self.control_mode = control_mode
        self.seed_spectrum = seed_spectrum

        self.r = 5
        self.S_cs = np.pi*self.r**2
        self.volume = 2/3*np.pi*self.r**3
        self.rho = 1025
        self.g = 9.81
        self.m = self.rho * self.volume 

        self.G_star = G_star
        self._setup_hydrodynamics()
        
        self.C = C
        self.K = K
        
        ######################## Latching control ########################
        if self.control_mode == 'latching':
            self.C_star = C_star
            self.C = self.C_star * self.r**2.5 * self.rho * self.g**0.5
            self.K = 0

        self.u = 0.0 ## control inactive
        
        ##################################################################
        self.t_final = t_final
        self.d_t = d_t
        self.eval_window_len = (self.d_t * 100) // 2

        # Bind the integration system dynamically to avoid branch checks (if) in solve loop
        if self.regular:
            if self.control_mode == 'linear':
                self.system = self._system_regular_linear
            else:
                self.system = self._system_regular_latching
        else:
            if self.control_mode == 'linear':
                self.system = self._system_irregular_linear
            else:
                self.system = self._system_irregular_latching


    def _setup_hydrodynamics(self):
        """Unified method to compute constants to avoid duplicating code in init and update"""
        self.T = self.ss_period[self.sea_state]
        self.Hw = self.ss_wh[self.sea_state]
        self.wave_velocity = self.g * self.T / (2 * np.pi)
        self.wave_l = self.wave_velocity * self.T
        self.k = 2*np.pi/self.wave_l
        self.ka = self.k * self.r

        self.A_star_interp = interp1d(Oscillator.ka_table[:, 0], Oscillator.ka_table[:, 1], kind='linear', fill_value="extrapolate")
        self.B_star_interp = interp1d(Oscillator.ka_table[:, 0], Oscillator.ka_table[:, 2], kind='linear', fill_value="extrapolate")
        self.A_star = Oscillator.ka_table[-1, 1]
        self.B_star = self.B_star_interp(self.ka)

        if not self.regular:
            ######################## IRREGULAR CASE ######################
            self.spectrum = self.init_irregular_parameters(self.sea_state, self.seed_spectrum)
            
            if self.spectrum is not None:
                self.N_freq = len(self.spectrum[0])
                self.amps = self.spectrum[0]         # A_ω
                self.omega = self.spectrum[1]        # ω
                self.phases = self.spectrum[2]       # φ
                B_array = self.B_star * (2/3*np.pi*self.r**3*self.rho*self.omega)
                weights = self.amps**2
                self.B = np.average(B_array, weights=weights)
                self.Lmbd = np.sqrt((2*self.rho*self.g**3*self.B)/(self.omega**3))
                coeff = (self.rho * self.g**2) / (64 * np.pi) * (10**-3)
                self.energy_wave = (coeff * self.Hw**2 * self.T) * (2 * self.r) * (10**3)
        
        else:
            ######################## REGULAR CASE ######################
            self.A_star = self.A_star_interp(self.ka)
            self.omega = 2*np.pi/self.T
            self.B = self.B_star * (2/3*np.pi*self.r**3*self.rho*self.omega)
            self.Lmbd = np.sqrt((2*self.rho*self.g**3*self.B)/(self.omega**3))
            coeff = (self.rho * self.g**2) / (8 * np.pi) * (10**-3)
            self.energy_wave = (coeff * self.Hw**2 * self.T) * (2 * self.r) * (10**3)
        
        self.m_add = self.A_star * (2/3*np.pi*self.r**3*self.rho)
        self.m_tot = self.m + self.m_add
        self.hydro_stiffness = self.rho * self.g * self.S_cs
        self.G = self.G_star * self.m_tot

    
    def init_irregular_parameters(self, nSS, seed):
        pm = PM_Spectrum(seed)
        nω = 256  # Number of frequency components
        ω_min = 2.0 * np.pi / 18.0
        ω_max = 2.0 * np.pi / 4.0
        Te, Hs, A_ω, ω, φ = pm.Amp_Phase(nSS, nω, ω_min, ω_max)
        spectral_input = (A_ω, ω, φ)
        return spectral_input


    def fe_t_irregular(self, t):
        """Calcola la forza di eccitazione per onde irregolari"""
        return np.sum(self.Lmbd * self.amps * np.cos(self.omega * t + self.phases))

    def wave_elevation_irregular(self, t):
        """Calcola l'elevazione dell'onda per onde irregolari"""
        return np.sum(self.amps * np.cos(self.omega * t + self.phases))

    def calculate_energy_absorbed(self):
        # Fully Vectorized Math
        v_sq = np.square(self.v)
        self.pow_inst = v_sq * self.C
        self.energy_abs = trapezoid(v_sq, self.t) * self.C
    
    # ------------------ SEPARATED ODE SYSTEMS FOR MAXIMUM SOLVER SPEED -------------- #
    def _system_regular_linear(self, t, X):
        x1, x2 = X
        fe_t = self.Lmbd * self.Hw * np.cos(self.omega * t)
        dx2_dt = (- (self.B + self.C) * x2 - (self.hydro_stiffness + self.K) * x1 + fe_t ) / self.m_tot
        return [x2, dx2_dt]

    def _system_regular_latching(self, t, X):
        x1, x2 = X
        fe_t = self.Lmbd * self.Hw * np.cos(self.omega * t)
        dx2_dt = (- (self.B + self.C + (self.G * self.u)) * x2 - (self.hydro_stiffness + self.K) * x1 + fe_t ) / self.m_tot
        return [x2, dx2_dt]

    def _system_irregular_linear(self, t, X):
        x1, x2 = X
        fe_t = self.fe_t_irregular(t)
        dx2_dt = (- (self.B + self.C) * x2 - (self.hydro_stiffness + self.K) * x1 + fe_t ) / self.m_tot
        return [x2, dx2_dt]

    def _system_irregular_latching(self, t, X):
        x1, x2 = X
        fe_t = self.fe_t_irregular(t)
        dx2_dt = (- (self.B + self.C + (self.G * self.u)) * x2 - (self.hydro_stiffness + self.K) * x1 + fe_t ) / self.m_tot
        return [x2, dx2_dt]
    # -------------------------------------------------------------------------------- #

    def solve(self, t_span=None, t_eval=None, initial_conditions=(0.0, 0.0), method='RK45'):
        if t_span is None:
            t_span = (0, self.t_final)
        
        # Solve the differential equation using solve_ivp
        if t_eval is None:
            step = int(self.eval_window_len)
            t_eval = np.linspace(t_span[0], t_span[1], step)  # Default time evaluation
        
        sol = solve_ivp(self.system, t_span, initial_conditions, t_eval=t_eval, method=method)
        self.t = sol.t
        self.x = sol.y[0]  # Position
        self.v = sol.y[1]  # Velocity

        # Vectorized Generation of Evaluation Arrays
        if self.regular:
            self.fe_t = self.Lmbd * self.Hw * np.cos(self.omega * self.t)
            self.wave_t = self.Hw * np.cos(self.omega * self.t)
        else:
            omega_t = self.omega[:, np.newaxis] * self.t[np.newaxis, :]
            cos_term = np.cos(omega_t + self.phases[:, np.newaxis])
            self.fe_t = np.sum((self.Lmbd * self.amps)[:, np.newaxis] * cos_term, axis=0)
            self.wave_t = np.sum(self.amps[:, np.newaxis] * cos_term, axis=0)
        
        self.calculate_energy_absorbed()

        return self.t, self.x, self.v, self.fe_t
    

    ## Nel caso in cui siano previsti valori variabili nella simulazione ##
    def update_sea_state(self, sea_state):
        self.set_sea_state(sea_state)
        self._setup_hydrodynamics()

    def get_sea_state(self):
        return self.sea_state
    
    def set_sea_state(self, ss):
        self.sea_state = ss
        self.set_period(self.ss_period[ss])
        self.set_wave_height(self.ss_wh[ss])
    
    def get_t_final(self):
        return self.t_final
    
    def get_d_t(self):
        return self.d_t

    def set_fpto(self, C, K):
        self.C = C
        self.K = K

    def set_G_star(self, g_star):
        self.G_star = g_star
        self.G = self.G_star * self.m_tot

    def get_G_star(self):
        return self.G_star
    
    def get_G(self):
        return self.G
    
    def get_C(self):
        return self.C
    
    def get_K(self):
        return self.K

    def get_latching(self):
        return self.u
    
    def set_latching(self, u):
        self.u = u

    def get_fpto_damping(self):
        return self.C
    
    def get_fpto_stifness(self):
        return self.K
    
    def get_speed(self):
        return self.v
    
    def get_position(self):
        return self.x
    
    def get_fet(self):
        return self.fe_t
    
    def get_timevector(self):
        return self.t
    
    def get_wavet(self):
        return self.wave_t
    
    def get_Lambda(self):
        return self.Lmbd
    
    def get_omega(self):
        return self.omega
    
    def get_omega_zero(self):
        self.omega_zero = np.sqrt((self.hydro_stiffness + self.K) / self.m_tot)
        return self.omega_zero
    
    def get_period_zero(self):
        omega_zero = self.get_omega_zero()
        self.period_zero = 2*np.pi/ omega_zero
        return self.period_zero

    def get_added_mass(self):
        return self.m_add
    
    def get_ktot(self):
        return self.rho * self.S_cs * self.g * self.K
    
    def get_opt_stifness_pto(self):
        if self.regular:
            return self.omega**2 * self.m_tot - self.hydro_stiffness
        else:
            # Per onde irregolari, calcola la stiffness ottimale come media pesata
            weights = self.amps**2
            return np.average(self.omega**2 * self.m_tot - self.hydro_stiffness, weights=weights)
    
    def get_opt_damping_pto(self):
        if self.regular:
            return self.B_star * 2/3*np.pi*self.r**3*self.rho*self.omega
        else:
            # Per onde irregolari, calcola il damping ottimale come media pesata
            weights = self.amps**2
            return self.B_star * np.average(2/3*np.pi*self.r**3*self.rho*self.omega, weights=weights)

    def get_period(self):
        return self.T
    
    def set_period(self, period):
        self.T = period
    
    def get_wave_height(self):
        return self.Hw
    
    def set_wave_height(self, Hw):
        self.Hw = Hw

    def get_eval_len(self):
        return int(self.eval_window_len)
    
    def get_wmode(self):
        return self.regular
    
    def get_pow_inst(self):
        return self.pow_inst
    
    def get_energy(self):
        return self.energy_abs
    
    def get_wave_energy(self):
        return self.energy_wave
    
    def get_control_mode(self):
        return self.control_mode
    
    def get_damping_c_star(self, C_star):
        return C_star*self.r**2.5*self.rho*self.g**0.5

    def get_table_period(self):
        return self.ss_period

    def plot(self):
        # Plot the results
        fig, ax = plt.subplots(nrows=2, ncols=1, figsize=(10, 6))
        fig.tight_layout(pad=3.0)

        plt.subplot(2, 1, 1)
        plt.plot(self.t, self.x, label=r'Buoy displacement $\xi(t)$')
        plt.plot(self.t, self.wave_t, label=r'Wave displacement $\zeta (t)$',color='#17becf')
        plt.xlabel(r'$t$ [s]')
        plt.ylabel(r'Displacement [m]')
        plt.legend(loc='lower right', fontsize='small')
        plt.ylim(-4,4)
        plt.grid()

        plt.subplot(2, 1, 2)
        plt.plot(self.t, self.v, label=r'Buoy velocity $\dot{\xi}(t)$',color='red')
        plt.plot(self.t, self.fe_t*10**-6, label=r'Excitation force $10^{-6} \times f_{e}(T)$',color='#1b9e77')
        plt.xlabel(r'$t$ [s]')
        plt.ylabel("Velocity [m/s]\nvs\n Wave force [MN]")
        plt.legend(loc='lower right', fontsize='small')
        plt.ylim(-4,4)
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
    oscillator.solve(t_eval= np.linspace(0, sim_time, 1000))
    oscillator.get_period_zero()
    oscillator.plot()
    plt.show()