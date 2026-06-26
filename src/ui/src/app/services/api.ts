const API_URL = "http://localhost:8000/api";

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
  lastModified: string;
}

export interface SimulationResult {
  id: string;
  filename: string;
  type: "train" | "test";
  timestamp: string;
  meanPower: number;
  maxDisplacement: number;
  maxVelocity: number;
}

export interface SimDataPoint {
  time: number;
  position: number;
  velocity: number;
  power_inst: number;
  excitation_force: number;
  control_signal: number;
}

export interface SimRequest {
  mode: "train" | "test";
  control: "rl" | "baseline";
  type: "latching" | "linear";
  sea_state: number;
  mixed?: boolean;
  regular?: boolean;
  sim_time?: number;
  save?: boolean;
  model_id?: string;
}

export const api = {
  getModels: async (): Promise<TrainedModel[]> => {
    const res = await fetch(`${API_URL}/models`);
    if (!res.ok) throw new Error("Failed to fetch models");
    return res.json();
  },

  getResults: async (): Promise<SimulationResult[]> => {
    const res = await fetch(`${API_URL}/results`);
    if (!res.ok) throw new Error("Failed to fetch results");
    return res.json();
  },

  getResultData: async (filename: string): Promise<SimDataPoint[]> => {
    const res = await fetch(`${API_URL}/results/${filename}`);
    if (!res.ok) throw new Error("Failed to fetch result data");
    return res.json();
  },

  runSimulation: async (req: SimRequest): Promise<{ status: string; output: string }> => {
    const res = await fetch(`${API_URL}/simulate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || "Simulation failed");
    }
    return res.json();
  },
};
