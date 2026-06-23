"""CREATE PIERSON-MOSKOVITZ SPECTRUM FOR GIVEN SIGNIFICANT WAVE HEIGHT AND ENERGY PERIOD"""

import numpy as np
import json

class PM_Spectrum:
    def __init__(self, seed):
        self.seed = seed
        with open("./src/config/config.json", "r") as f:
            config = json.load(f)

        self.Hs_tbl = config['wave_height_table']
        self.Te_tbl = config['period_table']
        # SS number:   0      1      2      3      4      5      6      7      8
        # po_tbl = ( 0.250, 0.200, 0.177, 0.145, 0.100, 0.070, 0.045, 0.007, 0.006 )

    def Amp_Phase(self, nSS, nω, ω_min, ω_max):
        Te = self.Te_tbl[nSS]
        Hs = self.Hs_tbl[nSS]
       
        ω_e = 2.0 * np.pi / Te
        ω_span = ω_max - ω_min
        Δω = ω_span / (nω-1)
       
        # Use numpy random state to maintain reproducibility while vectorizing
        rng = np.random.RandomState(self.seed)
   
        # Generate Δω_dist vectorially
        signs = np.where(rng.uniform(0, 1, nω) <= 0.5, 0.2, -0.2)
        Δω_dist = (1.0 + signs * rng.uniform(0, 1, nω)) * Δω
        
        # Re-scaling the new Delta omega so it fits the interval [omega_min,omega_max]
        Σ_Δω = np.sum(Δω_dist) - (Δω_dist[0] + Δω_dist[-1]) / 2.0
        ratio = ω_span / Σ_Δω
        Δω_dist *= ratio

        # Generate omega vectorially (cumulative sum)
        ω = np.zeros(nω)
        ω[0] = ω_min
        ω[1:] = ω_min + np.cumsum(0.5 * (Δω_dist[1:] + Δω_dist[:-1]))

        # Generate phases vectorially
        φ = 2.0 * np.pi * rng.uniform(0, 1.0, nω)

        # Generate sigma condition vectorially
        σ = np.where(ω < ω_e, 0.07, 0.09)

        # Vectorized spectrum calculations
        num = ω - ω_e
        den = ω_e * σ
        a = np.exp(-0.5 * (num / den)**2)

        # Constants moved out of the loop
        Γ_s = 2.8
        A_Γ = 1.0 - 0.287 * np.log(Γ_s)

        # Pierson-Moskowitz/JONSWAP spectra to compute the energy spectrum density
        S_pm = (5.0 / 16.0) * (Hs**2) * (ω_e**4) / (ω**5) * np.exp(-1.25 * (ω_e / ω)**4)
        S_i = A_Γ * (Γ_s ** a) * S_pm
        
        A_ω = np.sqrt(2.0 * Δω_dist * S_i)
           
        return Te, Hs, A_ω, ω, φ