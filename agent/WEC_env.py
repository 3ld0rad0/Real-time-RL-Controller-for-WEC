import gymnasium as gym
import numpy as np
import json
import time
import os
import matplotlib.pyplot as plt
import pandas as pd

# Define the custom environment based on buoy simulation

class WECEnv_Linear(gym.Env):
    def __init__(self, t_final, warmup, socket, init_data, sim_mode, reward_file_path):
        super(WECEnv_Linear,self).__init__()
        
        self.socket = socket
        self.init_data = init_data
        self.reward_file_path = reward_file_path
        self.t_final = t_final
        self.current_time = 0.0

        # warmup values
        self.x_obs = np.ceil(warmup[0])
        self.v_obs = np.ceil(warmup[1])
        self.C_opt = warmup[2]
        self.K_opt = np.abs(warmup[3])

        self.curr_period = warmup[4]
        self.curr_Hw = warmup[5]

        
        self.delta_max = 10000.0  # massimo cambiamento ammesso per step
        
        

        # Stato: [displacement, speed, PTO_damping_coeff, PTO_stifness_coeff]
        self.observation_space = gym.spaces.Box(
            low=np.array([-1.0, -1.0, 0.0,  -1.0], dtype=np.float32),
            high=np.array([ 1.0,  1.0,  1.0,  1.0], dtype=np.float32),
            dtype=np.float32
        )
        
        # Azione: [-delta_max, +delta_max]
        self.action_space = gym.spaces.Box(low= -1.0, high=1.0, shape=(2,), dtype=np.float32)

        # valutare se mantenere la possibilià di avg
        self.avg = False
        # valutare variabile var_values
        self.var_values = False
        
        self.n_step = 0
        self.n_ep = 0
        self.reward_v = []
        self.cum_reward = []
        self.checkpoint_reward = 600


        self.episodes = self.init_data['n_episodes']
        self.max_steps_per_episode = self.init_data['max_steps_per_episode']
        self.current_ep_step = 0
        self.sim_mode = sim_mode
        self.reset()
    
    def get_current_time(self):
        return self.current_time
    
    def get_t_final(self):
        return self.t_final

    def normalize_state(self, state):
        x, v, C, K = state
        return np.array([
            x / self.x_obs,
            v / self.v_obs,
            C / self.C_opt,
            K / self.K_opt
        ], dtype=np.float32)
    
    
    # def update_values(self, values, file_path = './warmup.json'):
    #     with open(file_path, "r") as f:
    #         warmup_values = json.load(f)

    #     period, Hw, mode = values
    #     w_mode = 'regular' if mode else 'irregular'
    #     w_params = f"T_{period}_Hw_{Hw}"
    #     w_v = warmup_values[w_mode][w_params]

    #     self.x_obs = np.float64(w_v["x_max"])
    #     self.v_obs = np.float64(w_v["v_max"])
    #     self.C_opt = np.float64(w_v['opt_damping'])
    #     self.K_opt = np.float64(w_v['opt_stifness'])

    #     self.curr_period = period
    #     self.curr_Hw = Hw
    
    def get_observation(self):
        payload_get = {"cmd": "get"}
        self.socket.sendall((json.dumps(payload_get) + "\n").encode())
            
        response = self.socket.recv(1024).decode().strip()
        state_raw = json.loads(response)

        # curr_period = state_raw['period']
        # curr_hw = state_raw['wave_height']
        # w_mode = state_raw['w_mode']
        
        # # in caso di simulazione dove i valori di periodo e altezza d'onda cambino nel tempo
        # if self.curr_period != curr_period or self.curr_Hw != curr_hw :
        #     self.update_values((curr_period, curr_hw, w_mode))

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
        #penalty_x = 0.0
        self.reward = power - penalty_x

        self.n_step += 1
        self.current_ep_step += 1
        self.cum_reward.append(self.reward)

        if self.n_step % self.checkpoint_reward == 0:
            
            self.reward_v.append({
                "step": self.n_step,
                "reward": np.mean(self.cum_reward)
            })
        

        if self.sim_mode == 'train':
            # self.done = self.current_ep_step >= self.max_steps_per_episode
            self.terminated = self.current_ep_step >= self.max_steps_per_episode
            if self.terminated:
                # se la simulazione prevede valori variabili di periodo e altezza d'onda
                # if self.var_values:
                #     payload_done = {'cmd' : 'done'}
                #     self.socket.sendall((json.dumps(payload_done) + "\n").encode())
                
                self.n_ep += 1
                print(f'Episode {self.n_ep} completed...')

        if self.current_time == self.t_final:
            self.save_reward()
            # self.done = True
            self.truncated = True

        self.observation = np.array(self.state, dtype=np.float32)
        info = {}
        
        return self.observation, self.reward.item(), bool(self.terminated), bool(self.truncated), info

    
    def save_reward(self):
        df_reward = pd.DataFrame(self.reward_v)
        header = not os.path.exists(self.reward_file_path)
        df_reward.to_csv(self.reward_file_path, mode='a', header= header, index=False)

    
    def reset(self):
        self.terminated = False
        self.truncated = False
        #self.done = False
        self.state = (0.0, 0.0, 0.0, 0.0)
        self.current_ep_step = 0
        self.observation = np.array(self.state, dtype= np.float32)
        info = {}
        return self.observation, info
    

class WECEnv_Latching(gym.Env):

    def __init__(self, t_final, warmup, socket, init_data, sim_mode, reward_file_path):
        super(WECEnv_Latching,self).__init__()
        
        self.socket = socket
        self.t_final = t_final
        self.current_time = 0.0
        self.init_data = init_data
        self.reward_file_path = reward_file_path
        self.fixed_G_star = self.init_data['fixed_G_star']

        # warmup values
        self.x_obs = np.ceil(warmup[0])
        self.v_obs = np.ceil(warmup[1])
        self.C_opt = warmup[2]
        self.K_opt = np.abs(warmup[3])
        self.curr_period = warmup[4]
        self.curr_Hw = warmup[5]
        self.fet_obs = np.ceil(warmup[6])
        #self.G_star_opt = 10.0  # Valore di G* ottimale, da definire in base alla simulazione

        
        # Stato: [position, speed, PTO_damping_coeff, fet, G]
        self.observation_space = gym.spaces.Box(
            low=np.array([-1.0, -1.0, 0.0, -1.0, 0.0], dtype=np.float32),
            high=np.array([1.0, 1.0, 1.0, 1.0, 1.0], dtype=np.float32),
            dtype=np.float32
        )

        if not self.fixed_G_star:
            # Azione: [ 0, 1 ] --> 0 = no latching, 1 = latching
            # Azione : [ 0, 1, 2 ] --> 0 = nessuna azione, 1 = aumenta G*, 2 = diminuisci G*
            self.action_space = gym.spaces.MultiDiscrete([2,3])

        else:
            # Azione: [ 0, 1 ] --> 0 = no latching, 1 = latching
            self.action_space = gym.spaces.Discrete(2)

        # valutare variabile var_values
        self.var_values = False
        self.n_step = 0
        self.n_ep = 0
        self.reward_v = []
        self.cum_reward = []
        self.checkpoint_reward = 600


        self.init_G_star = self.init_data['init_G_star']
        self.G_star_opt = self.init_data['opt_G_star']

        self.alpha = self.init_data['alpha']
        self.beta = self.init_data['beta']
        self.gamma = self.init_data['gamma']

        self.episodes = self.init_data['n_episodes']
        self.max_steps_per_episode = self.init_data['max_steps_per_episode']
        self.current_ep_step = 0 
        self.sim_mode = sim_mode
        self.reset()


    def get_current_time(self):
        return self.current_time


    def get_t_final(self):
        return self.t_final


    def normalize_state(self, state):
        x, v, C, fe_t, G_star = state
        return np.array([
            x / self.x_obs,
            v / self.v_obs,
            C / self.C_opt,
            fe_t / self.fet_obs,
            G_star / self.G_star_opt
        ], dtype=np.float32)


    # def update_values(self, values, file_path = './warmup.json'):
    #     with open(file_path, "r") as f:
    #         warmup_values = json.load(f)

    #     period, Hw, mode = values
    #     w_mode = 'regular' if mode else 'irregular'
    #     w_params = f"T_{period}_Hw_{Hw}"
    #     w_v = warmup_values[w_mode][w_params]

    #     self.x_obs = np.float64(w_v["x_max"])
    #     self.v_obs = np.float64(w_v["v_max"])
    #     self.C_opt = np.float64(w_v['opt_damping'])
    #     self.K_opt = np.float64(w_v['opt_stifness'])

    #     self.curr_period = period
    #     self.curr_Hw = Hw

    
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
        
        
        self.state = (state_raw['position'], state_raw['velocity'], state_raw['f_pto_damp'], state_raw['excitation_force'], state_raw['G_star'])
        
        self.current_time = state_raw['time']
        #print(f"Current State: {self.state}")

    
    def send_action(self, control):
        #print('Send Action')
        control_u = str(control[0])
        control_G_star = str(control[1])

        
        payload_control = {
            "cmd": "control",
            "params": {
                "u": control_u,
                "G_star": control_G_star
            }
        }
        self.socket.sendall((json.dumps(payload_control) + "\n").encode())

    
    def control_action_u(self, action):
        a = 1.0 if action else 0.0
        return a


    def control_action_G_star(self, action):
        
        if action == 0:
            action = -1.0

        elif action == 1:
            action = 0.0
        
        else:
            action = 1.0
        
        d_G = (self.state[3] * self.G_star_opt) + action
        new_G = np.clip(d_G, 1.0, self.G_star_opt)
        
        return new_G


    def step(self, action):
        
        # Send the action to Oscillator Simulation and at the same time we have the information of the new state
        
        if not self.fixed_G_star:
            new_u = self.control_action_u(action[0])
            new_G_star = self.control_action_G_star(action[1])
        
        else:
            # se G* è fissato, l'azione è solo il latching
            new_u = self.control_action_u(action)
            new_G_star = self.init_G_star
        
        self.send_action((new_u, new_G_star))
        time.sleep(0.01)
        self.get_observation()

        normalized_state = self.normalize_state(self.state)
        self.state = normalized_state

        x = self.state[0]
        v = self.state[1]
        C = self.state[2]
        fe = self.state[3]
        G_star = self.state[4]

        f_pto = -(C * v)
        power_term =  self.alpha * np.abs(v * f_pto)
        
        position_term = 0.01 * x**2  # Penalità per spostamenti eccessivi
        # velocity_term = (10**-3) * v**2  # Penalità per velocità eccessive
        
        # m = 402517.0
    
        latching_term = self.beta * (new_u * G_star* v **2)

        phase_term = self.gamma * np.abs (fe * v)

        self.reward = power_term + latching_term + phase_term

        self.n_step += 1
        self.current_ep_step += 1
        self.cum_reward.append(self.reward)

        if self.n_step % self.checkpoint_reward == 0:
            
            self.reward_v.append({
                "step": self.n_step,
                "reward": np.mean(self.cum_reward)
            })
            self.cum_reward.clear()

        if self.sim_mode == 'train':
            #done = (self.current_time % (self.t_final//self.episodes)) == 0
            #self.done = self.current_ep_step >= self.max_steps_per_episode
            self.terminated = self.current_ep_step >= self.max_steps_per_episode

            if self.terminated:
                # se la simulazione prevede valori variabili di periodo e altezza d'onda
                # if self.var_values:
                #     payload_done = {'cmd' : 'done'}
                #     self.socket.sendall((json.dumps(payload_done) + "\n").encode())
                
                self.n_ep += 1
                print(f'Episode {self.n_ep} completed...')


        
        if self.current_time == self.t_final:
            self.save_reward()
            #self.done = True
            self.truncated = True

        self.observation = np.array(self.state, dtype=np.float32)
        info = {}
        
        return self.observation, self.reward.item(), bool(self.terminated), bool(self.truncated), info


    def save_reward(self):
        df_reward = pd.DataFrame(self.reward_v)
        header = not os.path.exists(self.reward_file_path)
        df_reward.to_csv(self.reward_file_path, mode='a', header= header, index=False)

    
    def reset(self, seed = None):
        #self.done = False
        self.terminated = False
        self.truncated = False
        self.state = (0.0 ,0.0, 0.0, 0.0, self.init_G_star)
        self.state = self.normalize_state(self.state)
        self.current_ep_step = 0
        self.observation = np.array(self.state, dtype= np.float32)
        info = {}
        
        return self.observation, info