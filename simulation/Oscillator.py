import numpy as np
from scipy.integrate import solve_ivp, trapezoid

class Oscillator:
    def __init__(self, period, Hw, C, K, G_star, regular, t_final, control_mode, d_t, spectrum):
        self.area = 5
        self.S_cs = np.pi*self.area**2
        self.volume = 2/3*np.pi*self.area**3
        self.rho = 1025
        self.m = self.rho * self.volume
        self.m_add =  2/3*np.pi*self.area**3*self.rho 
        self.T = period
        self.omega = 2*np.pi/self.T
        self.B = 2/3*np.pi*self.area**3*self.rho*self.omega
        self.C = C
        self.g = 9.81
        self.K = K
        #self.K = self.omega**2*(self.m+self.m_add)-self.rho*self.g*self.S_cs
        self.Hw = Hw
        self.Lmbd = np.sqrt((2*self.rho*self.g**3*self.B)/(self.omega**3))
        self.spectrum = spectrum

        self.control_mode = control_mode
        
        ## Latching control ##
        if self.control_mode == 'latching':
            #self.C = self.C / ((self.area**(5/2)) * self.rho * (self.g** (1/2))) ## C*
            self.C = 0.3 * self.get_opt_damping_pto()
            self.K = 0

        self.G_star = G_star
        self.opt_G_star = 10
        self.G = self.G_star * (self.m_add + self.m)
        self.u = 0.0 ## control inactive
        ######################
        
        self.regular = regular
        self.t_final = t_final
        self.d_t = d_t
        self.eval_window_len = (self.d_t * 100) // 2

        if not self.regular:

            if self.spectrum is not None:
                # Usa lo spettro da PM_Spectrum
                self.N_freq = len(self.spectrum[0])  
                self.freqs = self.spectrum[1]        # ω
                self.amps = self.spectrum[0]         # A_ω
                self.phases = self.spectrum[2]       # φ
            
            else:
                self.N_freq = 100  # numero componenti armoniche
                self.freqs = np.linspace(0.5 * self.omega, 1.5 * self.omega, self.N_freq)
                self.amps = np.random.rand(self.N_freq) * (self.Hw / self.N_freq)
                self.phases = 2 * np.pi * np.random.rand(self.N_freq)



    def fe_t_irregular(self, t):
        """Calcola la forza di eccitazione per onde irregolari"""
        # Calcola Lmbd per ogni frequenza
        Lmbd_freqs = np.sqrt((2*self.rho*self.g**3*self.B)/(self.freqs**3))
        
        # Somma le componenti armoniche
        force = np.sum([
            Lmbd_freqs[i] * self.amps[i] * np.cos(self.freqs[i] * t + self.phases[i])
            for i in range(self.N_freq)
        ])
        
        return force

    def wave_elevation_irregular(self, t):
        """Calcola l'elevazione dell'onda per onde irregolari"""
        return np.sum([
            self.amps[i] * np.cos(self.freqs[i] * t + self.phases[i])
            for i in range(self.N_freq)
        ])

    def system(self, t, X):
        # Define the differential equations
        x1, x2 = X  # X[0] = position (x1), X[1] = velocity (x2)
        
        if self.regular:
            self.fe_t = self.Lmbd*self.Hw*np.cos(self.omega*t)

        else:
            self.fe_t = self.fe_t_irregular(t)
        
        dx1_dt = x2
        
        if self.control_mode == 'linear':
            dx2_dt = (1 / (self.m + self.m_add)) * (- (self.B + self.C) * x2 - (self.rho * self.g * self.S_cs + self.K) * x1 + self.fe_t )

        elif self.control_mode == 'latching':
            dx2_dt = (1 / (self.m + self.m_add)) * (- (self.B + self.C + (self.G * self.u)) * x2 - (self.rho * self.g * self.S_cs + self.K) * x1 + self.fe_t )

        return [dx1_dt, dx2_dt]

    
    def solve(self, t_span=None, t_eval=None, initial_conditions=(0.0, 0.0), method='RK45'):
        if t_span is None:
            t_span = (0, self.t_final)
        # Solve the differential equation using solve_ivp
        if t_eval is None:
            #t_eval = np.arange(t_span[0], t_span[1] + self.d_t, self.d_t)
            step = int(self.eval_window_len)
            t_eval = np.linspace(t_span[0], t_span[1], step)  # Default time evaluation
        

        sol = solve_ivp(self.system, t_span, initial_conditions, t_eval=t_eval, method=method)
        self.t = sol.t
        self.x = sol.y[0]  # Position
        self.v = sol.y[1]  # Velocity


        if self.regular:
            self.fe_t = self.Lmbd * self.Hw * np.cos(self.omega * self.t)
            self.wave_t = self.Hw * np.cos(self.omega * self.t)
        
        else:
            self.fe_t = np.array([self.fe_t_irregular(ti) for ti in self.t])
            self.wave_t = np.array([self.wave_elevation_irregular(ti) for ti in self.t])

        
        self.pow_inst = []

        for ev in self.v:
            power = (ev**2) * self.C
            self.pow_inst.append(power)

        v_sq = self.v **2
        v_integral = trapezoid(v_sq, self.t)
        
        ## P_abs
        self.energy = v_integral * self.C
        ## P_wave
        self.energy_wave = self.calculate_energy_wave()

        self.eta = self.energy /self.energy_wave
    

    ## Nel caso in cui siano previsti valori variabili nella simulazione ##
    def update_values(self, period, Hw):
        self.set_period(period)
        self.set_wave_height(Hw)
        self.omega = 2*np.pi/self.T
        self.B = 2/3*np.pi*self.area**3*self.rho*self.omega
        self.Lmbd = np.sqrt((2*self.rho*self.g**3*self.B)/(self.omega**3))


    ## Calculate the effective energy of the wave
    def calculate_energy_wave(self):
        if not self.regular:
            d_omega = self.freqs[1] - self.freqs[0]
            S = self.amps**2 / (2 * d_omega)

            c_g = self.g / (2 * self.freqs)
            integrand = S * c_g
            P_wave = self.rho * self.g * trapezoid(integrand, self.freqs)
        
        else:
            A = self.Hw / 2
            c_g = self.g / (2 * self.omega)
            P_wave = 0.5 * self.rho * self.g * A**2 * c_g
            
        return P_wave

    
    def set_fpto(self, C, K):
        self.C = C
        self.K = K

    def get_latching(self):
        return self.u
    
    def set_latching(self, u):
        self.u = u

    def get_fpto_damping(self):
        return self.C
    
    def get_fpto_stifness(self):
        return self.K
    
    # def set_control(self, control_C, control_K):
    #     self.C += control_C
    #     self.K += control_K
    
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
    
    def get_pow_inst(self):
        return self.pow_inst
    
    def get_opt_stifness_pto(self):
        return self.omega**2*(self.m+self.m_add)-self.rho*self.g*self.S_cs
    
    def get_opt_damping_pto(self):
        return 2/3*np.pi*self.area**3*self.rho*self.omega
    
    def get_B(self):
        return self.B

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
    
    def get_energy(self):
        return self.energy
    
    def get_wave_energy(self):
        return self.energy_wave
    
    def get_eta(self):
        return self.eta
    
    def get_control_mode(self):
        return self.control_mode