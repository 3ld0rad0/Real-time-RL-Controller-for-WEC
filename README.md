# Reinforcement Learning Controller for Wave Energy Converter

In the following project a new real time controller for WEC, based on Reinforcement Learning, is proposed.
This is a Server-Client approach, where the Server processed the simulation environment, instead the client play the role of a real time controller.

The two control techniques examinated are : **latching control** and **linear control**.
A Point Absorber model is used in the tests on regular and irregular waves (PA Spectrum).

Proximal Policy Optimization algorithm is used to train the RL agent on different Sea States, a learning strategy that allows more generalization to the agent. The project is strongly influenced by the works of [Anderlini](https://www.researchgate.net/publication/344992071_Towards_Real-Time_Reinforcement_Learning_Control_of_a_Wave_Energy_Converter) and [Hao Qin](https://www.researchgate.net/publication/396058344_Latching_control_of_a_point_absorber_wave_energy_converter_in_irregular_wave_environments_coupling_computational_fluid_dynamics_and_deep_reinforcement_learning)

The approach shows that RL control, achieved better performance in terms of Absorbed Power, compared to a classic approach based on [Threshold Control](https://www.researchgate.net/publication/245196134_Experimental_and_numerical_investigation_of_non-predictive_phase-control_strategies_for_a_point-absorbing_wave_energy_converter).

Server-Client approach allows to create many Control scripts (in the **agent** folder) that you can run separately, without modify the Server logic.

# Instruction to run the program

- Modify the **config.json** file in the utils folder;
- Open two terminal windows, and navigate to the current project folder;
- Run in the first windows the following command, to start the Server: **python -m simulation.server**;
- Run in the second windows the following command to start the Client: **python -m agent.<your_controller>**;


The program will save the results in the **results** folder.