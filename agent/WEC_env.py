#import gymnasium as gym
import gym
import numpy as np
import json
import time

# Define the custom environment based on buoy simulation

class WECEnv_Linear(gym.Env):
    def __init__(self, t_final, warmup, socket):
        super(WECEnv_Linear,self).__init__()
        
        self.socket = socket
        self.t_final = t_final
        self.current_time = 0.0

        # warmup values
        self.x_obs = warmup[0]
        self.v_obs = warmup[1]
        self.C_opt = warmup[2]
        self.K_opt = np.abs(warmup[3])

        self.curr_period = warmup[4]
        self.curr_Hw = warmup[5]

        
        self.delta_max = 10000.0  # massimo cambiamento ammesso per step
        
        

        # Stato: [displacement, speed, PTO_damping_coeff, PTO_stifness_coeff]
        self.observation_space = gym.spaces.Box(low= -1.0, high=1.0, shape=(4,), dtype=np.float32)
        #self.observation_space = gym.spaces.Box(low= 0, high=1.0, shape=(4,), dtype=np.float32)
        
        # Azione: [-delta_max, +delta_max]
        self.action_space = gym.spaces.Box(low= -1.0, high=1.0, shape=(2,), dtype=np.float32)
        #self.action_space = gym.spaces.Box(low= 0, high=1.0, shape=(2,), dtype=np.float32)

        # valutare se mantenere la possibilià di avg
        self.avg = False
        # valutare variabile var_values
        self.var_values = False
        self.n_step = 0
        self.n_ep = 0
        self.reward_v = []

        self.reset()
    

    def normalize_state(self, state):
        x, v, C, K = state
        return np.array([
            x / np.ceil(self.x_obs),
            v / np.ceil(self.v_obs),
            C / self.C_opt,
            K / self.K_opt
        ], dtype=np.float32)

    
    def update_values(self, values, file_path = './warmup.json'):
        with open(file_path, "r") as f:
            warmup_values = json.load(f)

        period, Hw, mode = values
        w_mode = 'regular' if mode else 'irregular'
        w_params = f"T_{period}_Hw_{Hw}"
        w_v = warmup_values[w_mode][w_params]

        self.x_obs = np.float64(w_v["x_max"])
        self.v_obs = np.float64(w_v["v_max"])
        self.C_opt = np.float64(w_v['opt_damping'])
        self.K_opt = np.float64(w_v['opt_stifness'])

        self.curr_period = period
        self.curr_Hw = Hw
    
    def get_observation(self):
        payload_get = {"cmd": "get"}
        self.socket.sendall((json.dumps(payload_get) + "\n").encode())
            
        response = self.socket.recv(1024).decode().strip()
        state_raw = json.loads(response)

        curr_period = state_raw['period']
        curr_hw = state_raw['wave_height']
        w_mode = state_raw['w_mode']
        
        # in caso di simulazione dove i valori di periodo e altezza d'onda cambino nel tempo
        if self.curr_period != curr_period or self.curr_Hw != curr_hw :
            self.update_values((curr_period, curr_hw, w_mode))

        if self.avg:
            self.state = (state_raw['H_max_position'], state_raw['H_avg_velocity'], state_raw['H_avg_fpto_damp'], state_raw['H_avg_fpto_stif'])
        
        else :
            self.state = (state_raw['position'], state_raw['velocity'], state_raw['f_pto_damp'], state_raw['f_pto_stif'])
        
        self.current_time = state_raw['time']
        #print(f"Current State: {self.state}")

    def send_action(self, control):
        #print('Send Action')
        control_C = str(control[0])
        control_K = str(control[1])
        payload_control = {
            "cmd": "control",
            "params": {
                "C": control_C,  # Cambia il valore di smorzamento
                "K": control_K
            }
        }
        self.socket.sendall((json.dumps(payload_control) + "\n").encode())

    # Controlla se l'azione non porti i valori oltre i limiti dati dai valori ottimali
    def control_action(self, action):
        d_C = (self.state[2] * self.C_opt) + action[0]
        d_K = (self.state[3] * self.K_opt) + action[1]
        new_C = np.clip(d_C, 0, self.C_opt)  # C >= 0 e C <= C_opt
        new_K = np.clip(d_K, -self.K_opt, self.K_opt)

        return new_C, new_K 

    def step(self, action):
        
        # Send the action to Oscillator Simulation and at the same time we have the information of the new state
        delta_C = action[0] * self.delta_max
        delta_K = action[1] * self.delta_max
        
        new_C, new_K = self.control_action((delta_C, delta_K))

        
        self.send_action([new_C, new_K])
        time.sleep(0.01)
        self.get_observation()

        normalized_state = self.normalize_state(self.state)
        self.state = normalized_state

        
        x = self.state[0]
        v = self.state[1]
        
        C = self.state[2]
        K = self.state[3]

        f_pto = -(C * v) - (K * x)
        #power = np.abs((v**2) * f_pto)  # Potenza inst. estratta
        power = np.abs(v * f_pto)
        penalty_x = 0.01 * x**2  # Penalità per spostamenti eccessivi
        reward = power - penalty_x

        self.n_step += 1
        self.reward_v.append((self.n_step, reward))
        
        #normalized_state = self.normalize_state(self.state)
        #self.state = normalized_state
        done = (self.current_time % (self.t_final//4)) == 0

        if done:
            # se la simulazione prevede valori variabili di periodo e altezza d'onda
            if self.var_values:
                payload_done = {'cmd' : 'done'}
                self.socket.sendall((json.dumps(payload_done) + "\n").encode())
            
            self.n_ep += 1
            print(f'Episode {self.n_ep} completed...')
        
        return np.array(self.state, dtype=np.float32), reward, done, {}


    
    def reset(self):
        self.state = (0.0, 0.0, 0.0, 0.0)
        return np.array(self.state, dtype= np.float32)
    





class WECEnv_Latching(gym.Env):

    def __init__(self, t_final, warmup, socket):
        super(WECEnv_Latching,self).__init__()
        
        self.socket = socket
        self.t_final = t_final
        self.current_time = 0.0

        # warmup values
        self.x_obs = warmup[0]
        self.v_obs = warmup[1]
        self.C_opt = warmup[2]
        self.K_opt = np.abs(warmup[3])
        self.curr_period = warmup[4]
        self.curr_Hw = warmup[5]

        
        # Stato: [speed, PTO_damping_coeff]
        self.observation_space = gym.spaces.Box(low= -1.0, high=1.0, shape=(2,), dtype=np.float32)
        
        # Azione: [ 0, 1 ]
        self.action_space = gym.spaces.Discrete(2)


        # valutare variabile var_values
        self.var_values = False
        self.n_step = 0
        self.n_ep = 0
        self.reward_v = []

        self.reset()

    
    def normalize_state(self, state):
        v, C = state
        return np.array([
            v / np.ceil(self.v_obs),
            C / self.C_opt
        ], dtype=np.float32)
    

    def update_values(self, values, file_path = './warmup.json'):
        with open(file_path, "r") as f:
            warmup_values = json.load(f)

        period, Hw, mode = values
        w_mode = 'regular' if mode else 'irregular'
        w_params = f"T_{period}_Hw_{Hw}"
        w_v = warmup_values[w_mode][w_params]

        self.x_obs = np.float64(w_v["x_max"])
        self.v_obs = np.float64(w_v["v_max"])
        self.C_opt = np.float64(w_v['opt_damping'])
        self.K_opt = np.float64(w_v['opt_stifness'])

        self.curr_period = period
        self.curr_Hw = Hw

    
    def get_observation(self):
        payload_get = {"cmd": "get"}
        self.socket.sendall((json.dumps(payload_get) + "\n").encode())
            
        response = self.socket.recv(1024).decode().strip()
        state_raw = json.loads(response)

        curr_period = state_raw['period']
        curr_hw = state_raw['wave_height']
        w_mode = state_raw['w_mode']
        
        # in caso di simulazione dove i valori di periodo e altezza d'onda cambino nel tempo
        if self.curr_period != curr_period or self.curr_Hw != curr_hw :
            self.update_values((curr_period, curr_hw, w_mode))
        
        
        self.state = (state_raw['velocity'], state_raw['f_pto_damp'])
        
        self.current_time = state_raw['time']
        #print(f"Current State: {self.state}")

    
    def send_action(self, control):
        #print('Send Action')
        control_u = control
        
        payload_control = {
            "cmd": "control",
            "params": {
                "u": control_u,
            }
        }
        self.socket.sendall((json.dumps(payload_control) + "\n").encode())

    
    def control_action(self, action):
        a = 1.0 if action else 0.0
        return a

    
    def step(self, action):
        
        # Send the action to Oscillator Simulation and at the same time we have the information of the new state
        new_u = self.control_action(action)
        self.send_action(new_u)
        time.sleep(0.01)
        self.get_observation()

        normalized_state = self.normalize_state(self.state)
        self.state = normalized_state

        
        v = self.state[0]
        C = self.state[1]

        f_pto = -(C * v)
        #power = np.abs((v**2) * f_pto)  # Potenza inst. estratta
        power = np.abs(v * f_pto)
        #penalty_x = 0.01 * x**2  # Penalità per spostamenti eccessivi
        
        reward = power

        self.n_step += 1
        self.reward_v.append((self.n_step, reward))
        
        #normalized_state = self.normalize_state(self.state)
        #self.state = normalized_state
        done = (self.current_time % (self.t_final//4)) == 0

        if done:
            # se la simulazione prevede valori variabili di periodo e altezza d'onda
            if self.var_values:
                payload_done = {'cmd' : 'done'}
                self.socket.sendall((json.dumps(payload_done) + "\n").encode())
            
            self.n_ep += 1
            print(f'Episode {self.n_ep} completed...')
        
        return np.array(self.state, dtype=np.float32), reward, done, {}


    
    def reset(self):
        self.state = (0.0, 0.0)
        return np.array(self.state, dtype= np.float32)