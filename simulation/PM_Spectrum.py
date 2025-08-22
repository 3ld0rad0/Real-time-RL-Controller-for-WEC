import random
import numpy as np
import json


with open("./utils/config.json", "r") as f:
    config = json.load(f)



class PM_Spectrum:

    def __init__(self, seed):
        self.seed = seed
        with open("./utils/config.json", "r") as f:
            config = json.load(f)

        self.Hs_tbl = config['wave_height_table']
        self.Te_tbl = config['period_table']
        # SS number:   0      1      2      3      4      5      6      7      8
        # po_tbl = ( 0.250, 0.200, 0.177, 0.145, 0.100, 0.070, 0.045, 0.007, 0.006 )
 
    def Amp_Phase( self, nSS, nω, ω_min, ω_max ):
       
        Te = self.Te_tbl[nSS]
        Hs = self.Hs_tbl[nSS]
        #po = self.po_tbl[nSS]
       
        ω_e = 2.0 * np.pi / Te
        ω_span = ω_max - ω_min
        Δω = ω_span / (nω-1)
       
        #generates random numbers with the same seed to maintain comparable results
        random.seed(self.seed)
   
        Σ_Δω = 0.0
        Δω_dist = np.zeros( nω )    
       
        for i in range(0, nω):
            if random.uniform(0,1) <= 0.5:
                sign = +0.2
            else:
                sign = -0.2
               
            Δω_dist[i] = ( 1.0 + sign * random.uniform(0,1) ) * Δω        
            Σ_Δω += Δω_dist[i]  
           
        # Re-scaling the new Delta omega so it fits the interval [omega_min,omega_max]
        Σ_Δω = Σ_Δω - ( Δω_dist[0] + Δω_dist[-1] ) / 2.0
        ratio = ω_span / Σ_Δω
        Δω_dist *= ratio
   
        A_ω = np.zeros( nω )
        ω = np.zeros( nω )
        φ = np.zeros( nω )
       
        for i in range( nω ):
            if i > 0:
                ω[i] = ω[i-1] + 0.5 * ( Δω_dist[i] + Δω_dist[i-1] )    
            else:
                ω[0] = ω_min
           
            if ω[i] < ω_e:
                σ = 0.07
            else:
                σ = 0.09
 
            φ[i] = 2.0 * np.pi * random.uniform(0, 1.0)
           
            num = ω[i] - ω_e
            den = ω_e * σ
            a = np.exp( -0.5 * (num / den)**2 )
            Γ_s = 2.8
            A_Γ = 1.0 - 0.287 * np.log( Γ_s )
 
            # Pierson-Moskowitz spectra to compute the energy spectrum density
            S_pm = 5.0/16.0 * Hs**2 * ω_e**4 / ω[i]**5 * np.exp( -5.0/4.0 * (ω_e / ω[i])**4 )
            S_i = A_Γ * pow( Γ_s, a ) * S_pm
            A_ω[i] = np.sqrt( 2.0 * Δω_dist[i] * S_i )
           
        return Te, Hs, A_ω, ω, φ