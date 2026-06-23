# How to Run the WEC-RL Simulation

The project includes a unified runner script, `run.py`, which automatically configures the environment, starts the simulation server, and connects the appropriate control client.

## Using `run.py` (Recommended)

You can run the full simulation using the `run.py` script with various command-line arguments. This avoids the need to manually modify `utils/config.json` and manually start multiple terminals.

### Basic Examples

**1. Run a test with default settings (RL control, latching, sea state 5):**
```bash
python run.py
```

**2. Train a new RL model for 10 hours in sea state 4:**
```bash
python run.py --mode train --sim-time 10 --sea-state 4
```

**3. Run a test using the Baseline controller with linear control in regular waves:**
```bash
python run.py --mode test --control baseline --type linear --regular
```

**4. Run a test and save the results (plots, CSVs) at the end:**
```bash
python run.py --save
```

### Available Arguments

| Argument | Choices | Default | Description |
| :--- | :--- | :--- | :--- |
| `--mode` | `train`, `test` | `test` | Choose to train a new model or test an existing one. |
| `--control` | `rl`, `baseline` | `rl` | Use Reinforcement Learning or the Baseline controller. |
| `--type` | `latching`, `linear` | `latching` | Control mode (latching or linear). |
| `--sea-state` | `0` to `8` | `5` | Sea state to simulate. |
| `--mixed` | (flag) | | Enable mixed sea states during the simulation. |
| `--regular` | (flag) | | Use regular waves (instead of default irregular waves). |
| `--sim-time` | (float) | | Simulation time (hours for training, seconds for testing). |
| `--save` | (flag) | | Save the results (CSV, plots) at the end of the simulation. |

## Manual Approach (Advanced)

If you prefer to run the server and client separately (e.g., for debugging):

1. Modify the `config.json` file in the `utils` folder manually to set your parameters.
2. Open a terminal and start the server:
   ```bash
   python -m simulation.server
   ```
3. Open a second terminal and start the desired client:
   ```bash
   python -m agent.rl_control    # For RL Control
   # or
   python -m agent.th_control    # For Baseline (Threshold) Control
   ```
