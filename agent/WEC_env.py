"""DEFINE CUSTOM ENVIRONMENTS FOR REINFORCEMENT LEARNING AGENTS"""

import gymnasium as gym
import numpy as np
import json
import time
import os
import matplotlib.pyplot as plt
import pandas as pd
from collections import deque
import logging
import random

logger = logging.getLogger(__name__)

class WECEnv_Base(gym.Env):
    def __init__(self, t_final, warmup, socket, init_data, sim_mode, reward_file_path):
        super(WECEnv_Base, self).__init__()
        
        self.socket = socket
        self.init_data = init_data
        self.reward_file_path = reward_file_path
        self.t_final = t_final
        self.current_time = 0.0

        # warmup values
        with open('./utils/warmup.json', "r") as f:
            self.warmup_values = json.load(f)

        self.sea_state_values = list(range(0, 9))
        self.sea_state_weights = (0.250, 0.200, 0.177, 0.145, 0.100, 0.070, 0.045, 0.007, 0.006)

        self.x_obs = np.float64(np.ceil(warmup['x_warmup']))
        self.v_obs = np.float64(np.ceil(warmup['v_warmup']))
        self.fet_obs = np.float64(np.ceil(warmup.get('fet_warmup', 1.0)))
        self.C_opt = np.float64(warmup['opt_damping'])
        self.curr_period = warmup['period']
        self.curr_Hw = warmup['hw']

        self.n_step = 0
        self.n_ep = 0
        self.reward_v = []
        self.cum_reward = []
        self.hist_reward = deque(maxlen=50)
        self.reward_v.append({
            "step": 0,
            "reward": 0,
            "reward_mean": 0
        })
        self.checkpoint_reward = 1800
        self.mixed_sea_state = self.init_data.get('mixed_sea_state', False)

        self.episodes = self.init_data['n_episodes']
        self.max_steps_per_episode = self.init_data['max_steps_per_episode']
        self.current_ep_step = 0
        self.sim_mode = sim_mode
        self.ss_distribution = 'uniform'

    def get_current_time(self):
        return self.current_time

    def get_t_final(self):
        return self.t_final

    def get_current_state(self):
        return self.state

    def update_sea_state(self, values):
        period, Hw, mode = values
        w_mode = 'regular' if mode else 'irregular'
        w_params = f"T_{period}_Hw_{Hw}"
        w_v = self.warmup_values[w_mode][w_params]

        self.x_obs = np.float64(w_v["x_max"])
        self.v_obs = np.float64(w_v["v_max"])
        if "fet_max" in w_v:
            self.fet_obs = np.float64(w_v["fet_max"])
        self.C_opt = np.float64(w_v['opt_damping'])
        
        self._update_specific_warmup(w_v)

        self.curr_period = period
        self.curr_Hw = Hw
        # logger.info(f"Sea_state changed now period is {self.curr_period} and Hw is {self.curr_Hw}")

    def get_observation(self):
        payload_get = {"cmd": "get"}
        self.socket.send_msg(payload_get)
            
        state_raw = self.socket.recv_msg()

        curr_period = state_raw['period']
        curr_hw = state_raw['wave_height']
        w_mode = state_raw['w_mode']
        
        # in caso di simulazione dove i valori di periodo e altezza d'onda cambino nel tempo
        if self.curr_period != curr_period or self.curr_Hw != curr_hw:
            self.update_sea_state((curr_period, curr_hw, w_mode))

        self.state = self._parse_state(state_raw)
        self.current_time = state_raw['time']

    def save_reward(self):
        df_reward = pd.DataFrame(self.reward_v)
        header = not os.path.exists(self.reward_file_path)
        df_reward.to_csv(self.reward_file_path, mode='a', header=header, index=False)
        self.reward_v.clear()

    def _process_step_rewards_and_termination(self):
        self.n_step += 1
        self.current_ep_step += 1
        self.cum_reward.append(self.reward)

        if self.current_ep_step % self.checkpoint_reward == 0:
            episode_reward = np.sum(self.cum_reward)
            self.hist_reward.append(episode_reward)
            self.reward_v.append({
                "step": self.n_step,
                "reward": episode_reward,
                "reward_mean": np.mean(self.hist_reward) if self.hist_reward else 0
            })
            self.cum_reward.clear()

        if self.sim_mode == 'train':
            self.terminated = self.current_ep_step >= self.max_steps_per_episode
            if self.terminated:
                self.n_ep += 1
                # se la simulazione prevede valori variabili di periodo e altezza d'onda
                if (self.n_ep < self.episodes) and self.mixed_sea_state:
                    try:
                        new_sea_state = None
                        if self.ss_distribution == 'uniform':
                            new_sea_state = self.np_random.integers(0, 9)
                        else:
                            new_sea_state = self.np_random.choice(self.sea_state_values, p=self.sea_state_weights)

                        payload_done = {'cmd' : 'done', 'new_sea_state': new_sea_state}
                        self.socket.send_msg(payload_done)
                    except Exception as e:
                        logger.error("Errore nell'invio del messaggio... ", e)
                
                logger.info(f'Episode {self.n_ep} completed...')

        if self.current_time == self.t_final:
            self.save_reward()
            self.truncated = True

        self.observation = np.array(self.state, dtype=np.float32)
        info = {}
        
        return self.observation, float(self.reward), bool(self.terminated), bool(self.truncated), info

    def reset(self, *, seed=None, options=None):
        super().reset(seed=seed)
        self.terminated = False
        self.truncated = False
        self.current_ep_step = 0
        self._init_state()
        self.observation = np.array(self.state, dtype=np.float32)
        info = {}
        return self.observation, info

    # Hooks to be implemented by child classes
    def _update_specific_warmup(self, w_v):
        pass

    def _parse_state(self, state_raw):
        raise NotImplementedError

    def _init_state(self):
        raise NotImplementedError


# Define the custom environment based on buoy simulation
class WECEnv_Linear(WECEnv_Base):
    def __init__(self, t_final, warmup, socket, init_data, sim_mode, reward_file_path):
        super(WECEnv_Linear, self).__init__(t_final, warmup, socket, init_data, sim_mode, reward_file_path)
        
        self.K_opt = np.float64(warmup['opt_stifness'])
        self.delta_max = 10000.0  # massimo cambiamento ammesso per step
        
        # Stato: [displacement, speed, PTO_damping_coeff, PTO_stifness_coeff]
        self.observation_space = gym.spaces.Box(
            low=np.array([-1.0, -1.0, 0.0,  -1.0], dtype=np.float32),
            high=np.array([ 1.0,  1.0,  1.0,  1.0], dtype=np.float32),
            dtype=np.float32
        )
        
        # Azione: [-delta_max, +delta_max]
        self.action_space = gym.spaces.Box(low= -1.0, high=1.0, shape=(2,), dtype=np.float32)

    def _update_specific_warmup(self, w_v):
        self.K_opt = np.float64(w_v['opt_stifness'])

    def normalize_state(self, state):
        x, v, C, K = state
        return np.array([
            x / self.x_obs,
            v / self.v_obs,
            C / self.C_opt,
            K / self.K_opt
        ], dtype=np.float32)

    def _parse_state(self, state_raw):
        return (state_raw['position'], state_raw['velocity'], state_raw['f_pto_damp'], state_raw['f_pto_stif'])

    def _init_state(self):
        self.state = (0.0, 0.0, 0.0, 0.0)

    def send_action(self, control):
        control_C = str(control[0])
        control_K = str(control[1])
        payload_control = {
            "cmd": "control",
            "params": {
                "C": control_C,  # Cambia il valore di smorzamento
                "K": control_K
            }
        }
        self.socket.send_msg(payload_control)

    def control_action(self, action):
        d_C = (self.state[2] * self.C_opt) + action[0]
        d_K = (self.state[3] * self.K_opt) + action[1]
        new_C = np.clip(d_C, 0, self.C_opt)  # C >= 0 e C <= C_opt
        new_K = np.clip(d_K, -self.K_opt, self.K_opt)
        return new_C, new_K 

    def step(self, action):
        delta_C = action[0] * self.delta_max
        delta_K = action[1] * self.delta_max
        
        new_C, new_K = self.control_action((delta_C, delta_K))
      
        self.send_action([new_C, new_K])
        self.get_observation()

        normalized_state = self.normalize_state(self.state)
        self.state = normalized_state

        x, v, C, K = self.get_current_state()

        f_pto = -(C * v) - (K * x)
        power = abs(v * f_pto)
        penalty_x = 0.01 * x**2  # Penalità per spostamenti eccessivi
        self.reward = power - penalty_x

        return self._process_step_rewards_and_termination()


class WECEnv_Latching(WECEnv_Base):
    def __init__(self, t_final, warmup, socket, init_data, sim_mode, reward_file_path):
        super(WECEnv_Latching, self).__init__(t_final, warmup, socket, init_data, sim_mode, reward_file_path)
        
        self.fixed_G_star = self.init_data['fixed_G_star']
        self.init_G_star = self.init_data['init_G_star']
        self.current_G_star = self.init_G_star
        self.G_star_opt = self.init_data['opt_G_star']

        self.alpha = self.init_data['alpha']
        self.gamma = self.init_data.get('gamma', 1.0)

        # Stato: [position, speed, fet, PTO_damping_coeff, G]
        self.observation_space = gym.spaces.Box(
            low=np.array([-1.0, -1.0, -1.0, 0.0, 0.0], dtype=np.float32),
            high=np.array([1.0, 1.0, 1.0, 1.0, 1.0], dtype=np.float32),
            dtype=np.float32
        )

        if not self.fixed_G_star:
            # Azione 0: [ 0, 1 ] --> 0 = no latching, 1 = latching
            # Azione 1: [ 0, 1, 2 ] --> 0 = nessuna azione, 1 = aumenta G*, 2 = diminuisci G*
            self.action_space = gym.spaces.MultiDiscrete([2,3])
        else:
            # Azione: [ 0, 1 ] --> 0 = no latching, 1 = latching
            self.action_space = gym.spaces.Discrete(2)

    def normalize_state(self, state):
        x, v, fe_t, C, G_star = state
        return np.array([
            x / self.x_obs,
            v / self.v_obs,
            fe_t / self.fet_obs,
            C / self.C_opt,
            G_star / self.G_star_opt
        ], dtype=np.float32)

    def _parse_state(self, state_raw):
        return (state_raw['position'], state_raw['velocity'], state_raw['excitation_force'], state_raw['f_pto_damp'], state_raw['G_star'])

    def _init_state(self):
        self.state = (0.0 ,0.0, 0.0, 0.0, self.init_G_star)
        self.state = self.normalize_state(self.state)
        self.current_G_star = self.init_G_star

    def send_action(self, control):
        control_u = str(control[0])
        control_G_star = str(control[1])

        payload_control = {
            "cmd": "control",
            "params": {
                "u": control_u,
                "G_star": control_G_star
            }
        }
        self.socket.send_msg(payload_control)

    def control_action_u(self, action):
        return 1.0 if action else 0.0

    def control_action_G_star(self, action):
        if action == 0:
            action = -1.0
        elif action == 1:
            action = 0.0
        else:
            action = 1.0
        
        d_G = (self.state[4] * self.G_star_opt) + action
        new_G = np.clip(d_G, 1.0, self.G_star_opt)
        self.current_G_star = new_G
        
        return new_G

    def step(self, action):
        if not self.fixed_G_star:
            new_u = self.control_action_u(action[0])
            # solo se il latching è attivo cambia il valore di G*
            new_G_star = self.control_action_G_star(action[1]) if new_u == 1.0 else self.current_G_star
        else:
            # se G* è fissato, l'azione è solo il latching
            new_u = self.control_action_u(action)
            new_G_star = self.init_G_star
        
        self.send_action((new_u, new_G_star))
        self.get_observation()

        normalized_state = self.normalize_state(self.state)
        self.state = normalized_state

        x, v, fe, C, G_star = self.get_current_state()

        f_pto = -(C * v)
        power_term = self.alpha * abs(v * f_pto)
        self.reward = power_term

        return self._process_step_rewards_and_termination()