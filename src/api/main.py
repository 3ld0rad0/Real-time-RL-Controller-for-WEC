from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import glob
import pandas as pd
from datetime import datetime
import subprocess
import sys

app = FastAPI(title="WEC-RL Controller API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if os.path.exists("results"):
    app.mount("/api/results_files", StaticFiles(directory="results"), name="results_files")

class SimRequest(BaseModel):
    mode: str  # "train" or "test"
    control: str # "rl" or "baseline"
    type: str # "latching" or "linear"
    sea_state: int
    mixed: bool = False
    regular: bool = False
    sim_time: float | None = None
    save: bool = True
    model_id: str | None = None # Used to configure which model to load in test mode
    retrain: bool = False
    batch_size: int = 2048
    entropy_coef: float = 0.01

sim_status = {
    "running": False,
    "output": ""
}

@app.get("/api/models")
def get_models():
    # scan models/ directory
    # structure: models/irregular/.../xxx.zip
    models_list = []
    model_id = 1
    for wave_type in ["irregular", "regular"]:
        base_path = os.path.join("models", wave_type)
        if not os.path.exists(base_path):
            continue
        for root, dirs, files in os.walk(base_path):
            for file in files:
                if file.startswith("ppomodel"):
                    path = os.path.join(root, file)
                    stat = os.stat(path)
                    
                    # Parse metadata from path or defaults
                    sea_state = 0
                    wave_height = 0.0
                    period = 0.0
                    ent_coef = 0.01
                    
                    try:
                        parts = path.split(os.sep)
                        for part in parts:
                            if part.startswith("sea_state_"):
                                ss_info = part.replace("sea_state_", "").split("_")
                                wave_height = float(ss_info[0])
                                period = float(ss_info[1])
                            if part.startswith("simulation_"):
                                ent_coef = float(part.replace("simulation_", ""))
                    except Exception:
                        pass
                    
                    models_list.append({
                        "id": str(model_id),
                        "path": path,
                        "name": file,
                        "waveType": wave_type,
                        "seaState": sea_state,
                        "waveHeight": wave_height,
                        "period": period,
                        "entCoef": ent_coef,
                        "size": stat.st_size / (1024 * 1024),
                        "lastModified": datetime.fromtimestamp(stat.st_mtime).isoformat()
                    })
                    model_id += 1
    return models_list

@app.get("/api/results")
def get_results():
    results_list = []
    if not os.path.exists("results"):
        return results_list
        
    res_id = 1
    for path in glob.glob("results/**/*.csv", recursive=True):
        stat = os.stat(path)
        mode = "train" if "train" in path.lower() else "test"
        
        # Try to find corresponding plot
        plot_path = path.replace(f"{os.sep}data{os.sep}", f"{os.sep}plot{os.sep}").replace(".csv", ".png")
        if not os.path.exists(plot_path):
            plot_path = path.replace(".csv", ".png")
            
        plot_url = None
        if os.path.exists(plot_path):
            rel_plot = os.path.relpath(plot_path, "results").replace("\\", "/")
            plot_url = f"http://localhost:8000/api/results_files/{rel_plot}"
            
        try:
            # Read a bit of data to get quick stats
            df = pd.read_csv(path, nrows=100)
            mean_power = df['Power (W)'].mean() if 'Power (W)' in df.columns else 0
            max_disp = df['Position (m)'].abs().max() if 'Position (m)' in df.columns else 0
            max_vel = df['Velocity (m/s)'].abs().max() if 'Velocity (m/s)' in df.columns else 0
        except Exception:
            mean_power = 0
            max_disp = 0
            max_vel = 0
            
        rel_path = os.path.relpath(path, "results").replace("\\", "/")
        
        results_list.append({
            "id": str(res_id),
            "filename": rel_path,
            "type": mode,
            "timestamp": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            "meanPower": float(mean_power),
            "maxDisplacement": float(max_disp),
            "maxVelocity": float(max_vel),
            "plotUrl": plot_url
        })
        res_id += 1
            
    # sort by timestamp desc
    results_list.sort(key=lambda x: x["timestamp"], reverse=True)
    return results_list

@app.get("/api/results/{filename:path}")
def get_result_data(filename: str):
    path = os.path.join("results", filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Result not found")
        
    try:
        df = pd.read_csv(path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read CSV: {e}")
        
    # Downsample if too large
    if len(df) > 1000:
        df = df.iloc[::len(df)//1000]
        
    # Standardize column names based on expected headers from typical WEC results
    col_map = {
        'Time (s)': 'time',
        'Position (m)': 'position',
        'Velocity (m/s)': 'velocity',
        'Power (W)': 'power_inst',
        'Excitation (N)': 'excitation_force',
        'Control': 'control_signal'
    }
    
    # Check if df has different names, try to match or fallback to defaults
    df = df.rename(columns=col_map)
    
    # Fill missing columns with 0
    for val in col_map.values():
        if val not in df.columns:
            df[val] = 0.0

    return df[['time', 'position', 'velocity', 'power_inst', 'excitation_force', 'control_signal']].to_dict(orient="records")

@app.get("/api/simulate/status")
def get_simulate_status():
    return sim_status

def background_simulation(cmd: list):
    global sim_status
    sim_status["running"] = True
    sim_status["output"] = ""
    try:
        process = subprocess.run(cmd, capture_output=True, text=True, check=True)
        sim_status["output"] = process.stdout
    except subprocess.CalledProcessError as e:
        sim_status["output"] = e.stdout + "\n" + e.stderr
    finally:
        sim_status["running"] = False

@app.post("/api/simulate")
def run_simulation(req: SimRequest, background_tasks: BackgroundTasks):
    if sim_status["running"]:
        raise HTTPException(status_code=400, detail="A simulation is already running")

    # Resolve model path if model_id is provided
    model_path = ""
    if req.model_id:
        models = get_models()
        for m in models:
            if m["id"] == req.model_id:
                model_path = m["path"]
                break

    # Prepare arguments for run.py
    cmd = [sys.executable, "run.py", "--mode", req.mode, "--control", req.control, "--type", req.type, "--sea-state", str(req.sea_state)]
    if req.mixed:
        cmd.append("--mixed")
    if req.regular:
        cmd.append("--regular")
    if req.sim_time is not None:
        cmd.extend(["--sim-time", str(req.sim_time)])
    if req.save:
        cmd.append("--save")
        
    if req.retrain:
        cmd.append("--retrain")
    if model_path:
        cmd.extend(["--model-path", model_path])
        
    cmd.extend(["--batch-size", str(req.batch_size)])
    cmd.extend(["--entropy-coef", str(req.entropy_coef)])

    background_tasks.add_task(background_simulation, cmd)
    return {"status": "started"}
