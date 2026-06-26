// Mock data for the WEC-RL Controller application

export const SEA_STATES = [
  { id: 0, label: "SS 0 (Hw=0.8m, T=9.0s)", height: 0.8, period: 9.0 },
  { id: 1, label: "SS 1 (Hw=1.2m, T=9.5s)", height: 1.2, period: 9.5 },
  { id: 2, label: "SS 2 (Hw=1.6m, T=10.0s)", height: 1.6, period: 10.0 },
  { id: 3, label: "SS 3 (Hw=2.0m, T=10.5s)", height: 2.0, period: 10.5 },
  { id: 4, label: "SS 4 (Hw=2.5m, T=11.0s)", height: 2.5, period: 11.0 },
  { id: 5, label: "SS 5 (Hw=3.0m, T=11.5s)", height: 3.0, period: 11.5 },
  { id: 6, label: "SS 6 (Hw=3.5m, T=12.0s)", height: 3.5, period: 12.0 },
  { id: 7, label: "SS 7 (Hw=4.0m, T=12.5s)", height: 4.0, period: 12.5 },
  { id: 8, label: "SS 8 (Hw=4.5m, T=13.0s)", height: 4.5, period: 13.0 },
];

export const CONTROLLERS = [
  { id: "rl", name: "RL Control (PPO)", file: "rl_control.py" },
  { id: "th", name: "Threshold Baseline", file: "th_control.py" },
];

export const CONTROL_MODES = [
  { id: "latching", name: "Latching" },
  { id: "linear", name: "Linear" },
];

export interface TrainedModel {
  id: string;
  path: string;
  name: string;
  waveType: "irregular" | "regular";
  seaState: number;
  waveHeight: number;
  period: number;
  entCoef: number;
  size: number;
  lastModified: Date;
}

export const TRAINED_MODELS: TrainedModel[] = [
  {
    id: "1",
    path: "models/irregular/sea_state_2.0_10.5/simulation_0.01/ppomodel_500000_steps.zip",
    name: "ppomodel_500000_steps.zip",
    waveType: "irregular",
    seaState: 3,
    waveHeight: 2.0,
    period: 10.5,
    entCoef: 0.01,
    size: 4.2,
    lastModified: new Date("2026-06-20T14:30:00"),
  },
  {
    id: "2",
    path: "models/irregular/sea_state_3.0_11.5/simulation_0.01/ppomodel_1000000_steps.zip",
    name: "ppomodel_1000000_steps.zip",
    waveType: "irregular",
    seaState: 5,
    waveHeight: 3.0,
    period: 11.5,
    entCoef: 0.01,
    size: 4.3,
    lastModified: new Date("2026-06-22T09:15:00"),
  },
  {
    id: "3",
    path: "models/regular/sea_state_1.6_10.0/simulation_0.005/ppomodel_750000_steps.zip",
    name: "ppomodel_750000_steps.zip",
    waveType: "regular",
    seaState: 2,
    waveHeight: 1.6,
    period: 10.0,
    entCoef: 0.005,
    size: 4.1,
    lastModified: new Date("2026-06-18T16:45:00"),
  },
  {
    id: "4",
    path: "models/irregular/sea_state_4.0_12.5/simulation_0.02/ppomodel_2000000_steps.zip",
    name: "ppomodel_2000000_steps.zip",
    waveType: "irregular",
    seaState: 7,
    waveHeight: 4.0,
    period: 12.5,
    entCoef: 0.02,
    size: 4.5,
    lastModified: new Date("2026-06-25T11:20:00"),
  },
  {
    id: "5",
    path: "models/regular/sea_state_2.5_11.0/simulation_0.01/ppomodel_500000_steps.zip",
    name: "ppomodel_500000_steps.zip",
    waveType: "regular",
    seaState: 4,
    waveHeight: 2.5,
    period: 11.0,
    entCoef: 0.01,
    size: 4.2,
    lastModified: new Date("2026-06-19T13:00:00"),
  },
];

export interface SimulationResult {
  id: string;
  filename: string;
  type: "train" | "test";
  timestamp: Date;
  meanPower: number;
  maxDisplacement: number;
  maxVelocity: number;
  data: {
    time: number;
    position: number;
    velocity: number;
    power_inst: number;
    excitation_force: number;
    control_signal: number;
  }[];
}

// Generate mock simulation data
const generateSimulationData = (points: number, seed: number) => {
  const data = [];
  for (let i = 0; i < points; i++) {
    const t = i * 0.1;
    const wavePhase = Math.sin(0.5 * t + seed) * 0.3;
    data.push({
      time: t,
      position: Math.sin(0.4 * t + seed) * 2 + wavePhase,
      velocity: Math.cos(0.4 * t + seed) * 0.8 + wavePhase * 0.5,
      power_inst: Math.abs(Math.sin(0.3 * t + seed) * 150 + 50),
      excitation_force: Math.sin(0.5 * t + seed) * 1000 + Math.random() * 100,
      control_signal: Math.sin(0.35 * t + seed) * 0.5 + 0.5,
    });
  }
  return data;
};

export const SIMULATION_RESULTS: SimulationResult[] = [
  {
    id: "1",
    filename: "test_rl_ss3_20260625_143022.csv",
    type: "test",
    timestamp: new Date("2026-06-25T14:30:22"),
    meanPower: 127.4,
    maxDisplacement: 2.8,
    maxVelocity: 1.2,
    data: generateSimulationData(150, 1),
  },
  {
    id: "2",
    filename: "test_rl_ss5_20260624_091505.csv",
    type: "test",
    timestamp: new Date("2026-06-24T09:15:05"),
    meanPower: 185.6,
    maxDisplacement: 3.4,
    maxVelocity: 1.6,
    data: generateSimulationData(150, 2),
  },
  {
    id: "3",
    filename: "train_rl_ss3_20260623_101230.csv",
    type: "train",
    timestamp: new Date("2026-06-23T10:12:30"),
    meanPower: 142.8,
    maxDisplacement: 3.1,
    maxVelocity: 1.4,
    data: generateSimulationData(200, 3),
  },
  {
    id: "4",
    filename: "test_th_ss2_20260622_153045.csv",
    type: "test",
    timestamp: new Date("2026-06-22T15:30:45"),
    meanPower: 98.2,
    maxDisplacement: 2.1,
    maxVelocity: 0.9,
    data: generateSimulationData(150, 4),
  },
  {
    id: "5",
    filename: "train_rl_ss7_20260621_083015.csv",
    type: "train",
    timestamp: new Date("2026-06-21T08:30:15"),
    meanPower: 235.7,
    maxDisplacement: 4.2,
    maxVelocity: 2.1,
    data: generateSimulationData(300, 5),
  },
];
