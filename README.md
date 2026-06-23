# Reinforcement Learning Controller for Wave Energy Converter

In the following project a new real time controller for WEC, based on Reinforcement Learning, is proposed.
This is a Server-Client approach, where the Server processed the simulation environment, instead the client play the role of a real time controller.

The two control techniques examinated are : **latching control** and **linear control**.
A Point Absorber model is used in the tests on regular and irregular waves (PA Spectrum).

Proximal Policy Optimization algorithm is used to train the RL agent on different Sea States, a learning strategy that allows more generalization to the agent. The project is strongly influenced by the works of [Anderlini](https://www.researchgate.net/publication/344992071_Towards_Real-Time_Reinforcement_Learning_Control_of_a_Wave_Energy_Converter) and [Hao Qin](https://www.researchgate.net/publication/396058344_Latching_control_of_a_point_absorber_wave_energy_converter_in_irregular_wave_environments_coupling_computational_fluid_dynamics_and_deep_reinforcement_learning)

The approach shows that RL control, achieved better performance in terms of Absorbed Power, compared to a classic approach based on [Threshold Control](https://www.researchgate.net/publication/245196134_Experimental_and_numerical_investigation_of_non-predictive_phase-control_strategies_for_a_point-absorbing_wave_energy_converter).

Server-Client approach allows to create many Control scripts (in the **src/control** folder) that you can run separately, without modifying the Server logic.

# Instruction to run the program

- The configuration file **config.json** is located in the **src/config** folder.
- You can now launch the entire simulation natively using the provided runner script. From the root of the project, execute:
  ```bash
  python run.py
  ```
  This script will automatically start both the Server and the chosen Client, parse your arguments, and execute the simulation.

- You can pass several arguments to customize the run directly from the command line without editing the JSON manually. For example:
  ```bash
  python run.py --mode train --control rl --type latching --sea-state 5 --save
  ```
  Use `python run.py --help` to see all available options.

The program will save the results in the **results** folder.