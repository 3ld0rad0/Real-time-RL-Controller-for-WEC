import streamlit as st
import subprocess
import sys
import os
import json
import glob
import time
import pandas as pd
import re

# ---------------------------------------------------------------------------
# Paths and Constants
# ---------------------------------------------------------------------------
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CONFIG_PATH = os.path.join(PROJECT_ROOT, "src", "config", "config.json")
RESULTS_DIR = os.path.join(PROJECT_ROOT, "results")
MODELS_DIR = os.path.join(PROJECT_ROOT, "models")
CONTROL_DIR = os.path.join(PROJECT_ROOT, "src", "control")

PERIOD_TABLE = [9.0, 9.5, 10.0, 10.5, 11.0, 11.5, 12.0, 12.5, 13.0]
WAVE_HEIGHT_TABLE = [0.8, 1.2, 1.6, 2.0, 2.4, 2.9, 3.4, 4.0, 4.5]

# ---------------------------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------------------------

def load_config():
    with open(CONFIG_PATH, "r") as f:
        return json.load(f)

def save_config(cfg):
    with open(CONFIG_PATH, "w") as f:
        json.dump(cfg, f, indent=2)

def get_available_controllers():
    """Scan src/control for valid controller files."""
    pattern = os.path.join(CONTROL_DIR, "*_control.py")
    files = glob.glob(pattern)
    controllers = []
    for f in files:
        base = os.path.basename(f)
        if base not in ["base_controller.py", "opt_control_offline.py"]:
            controllers.append(base)
    return sorted(controllers)

def scan_csv_results(sub_dir=""):
    """Return list of CSV paths under results/"""
    pattern = os.path.join(RESULTS_DIR, sub_dir, "**", "*.csv")
    files = sorted(glob.glob(pattern, recursive=True))
    return [f for f in files if "_reward" not in os.path.basename(f) and "_energy" not in os.path.basename(f)]

def find_matching_plot(csv_path):
    png_path = csv_path.replace("/data/", "/plot/").replace(".csv", ".png")
    return png_path if os.path.isfile(png_path) else None

def scan_models():
    """Return list of model files under models/"""
    pattern = os.path.join(MODELS_DIR, "**", "ppomodel*")
    # Also include .zip files just in case
    zip_pattern = os.path.join(MODELS_DIR, "**", "*.zip")
    files = list(set(glob.glob(pattern, recursive=True) + glob.glob(zip_pattern, recursive=True)))
    # Sort by modification time, newest first
    files.sort(key=lambda x: os.path.getmtime(x), reverse=True)
    return files

def _kill_procs():
    """Kill running simulation subprocesses."""
    for key in ("server_proc", "client_proc"):
        proc = st.session_state.get(key)
        if proc and proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                proc.kill()
    st.session_state["server_proc"] = None
    st.session_state["client_proc"] = None
    st.session_state["running"] = False

def launch_simulation(config_dict, client_module_name):
    """Start the subprocesses and return immediately."""
    save_config(config_dict)
    os.environ["MPLBACKEND"] = "Agg"
    
    # 1. Start server
    server_proc = subprocess.Popen(
        [sys.executable, "-m", "src.network.server"],
        cwd=PROJECT_ROOT,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=False
    )
    st.session_state["server_proc"] = server_proc
    time.sleep(2)

    if server_proc.poll() is not None:
        out_bytes = server_proc.stdout.read() if server_proc.stdout else b""
        out = out_bytes.decode('utf-8', errors='ignore') if isinstance(out_bytes, bytes) else ""
        st.error(f"Server crashed on startup:\n```\n{out}\n```")
        st.session_state["running"] = False
        return False

    # 2. Start client
    client_proc = subprocess.Popen(
        [sys.executable, "-m", f"src.control.{client_module_name.replace('.py', '')}"],
        cwd=PROJECT_ROOT,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, bufsize=1
    )
    st.session_state["client_proc"] = client_proc
    
    # Make server stdout non-blocking
    import fcntl
    fd = server_proc.stdout.fileno()
    fl = fcntl.fcntl(fd, fcntl.F_GETFL)
    fcntl.fcntl(fd, fcntl.F_SETFL, fl | os.O_NONBLOCK)

    st.session_state["running"] = True
    st.session_state["sim_pct"] = 0
    st.session_state["sim_buffer"] = ""
    return True

@st.fragment(run_every="1s")
def execution_status_fragment():
    if not st.session_state.get("running", False):
        return

    server_proc = st.session_state.get("server_proc")
    client_proc = st.session_state.get("client_proc")
    
    if not server_proc or not client_proc:
        return

    # Read all available characters
    progress_regex = re.compile(r"(\d{1,3})%")
    try:
        data_bytes = os.read(server_proc.stdout.fileno(), 4096)
        if data_bytes:
            data = data_bytes.decode('utf-8', errors='ignore')
            st.session_state["sim_buffer"] += data
            # extract all percentages
            matches = progress_regex.findall(st.session_state["sim_buffer"])
            if matches:
                pct = int(matches[-1])
                st.session_state["sim_pct"] = min(100, pct)
                # clear buffer to save memory but keep the last few chars just in case the % was cut
                st.session_state["sim_buffer"] = st.session_state["sim_buffer"][-10:]
    except OSError:
        # non-blocking read raises OSError (BlockingIOError) if no data is available
        pass
        
    pct = st.session_state.get("sim_pct", 0)
    st.progress(pct / 100.0, text=f"Simulating... {pct}%")
    
    if st.button("🛑 Stop Simulation", use_container_width=True, type="secondary"):
        _kill_procs()
        st.warning("Simulation stopped manually.")
        st.session_state["sim_success"] = False
        st.rerun()

    # Check if finished
    if client_proc.poll() is not None:
        rc = client_proc.returncode
        
        # Cleanup
        try:
            server_proc.wait(timeout=2)
        except subprocess.TimeoutExpired:
            server_proc.terminate()
            
        st.session_state["running"] = False
        st.session_state["server_proc"] = None
        st.session_state["client_proc"] = None
        
        if rc == 0:
            st.session_state["sim_success"] = True
        else:
            st.session_state["sim_success"] = False
            st.error("❌ Simulation failed or was interrupted.")
            
        st.rerun()

# ---------------------------------------------------------------------------
# Page Config & State Initialization
# ---------------------------------------------------------------------------
st.set_page_config(page_title="WEC-RL Controller", page_icon="🌊", layout="wide")

if "page" not in st.session_state:
    st.session_state["page"] = "home"
if "running" not in st.session_state:
    st.session_state["running"] = False
if "selected_model" not in st.session_state:
    st.session_state["selected_model"] = ""

def nav_to(page):
    if not st.session_state["running"]:
        st.session_state["page"] = page

# ---------------------------------------------------------------------------
# Styling
# ---------------------------------------------------------------------------
st.markdown("""
    <style>
    [data-testid="stSidebar"] { display: none; } /* Hide sidebar for app-like feel */
    [data-testid="stStatusWidget"] { visibility: hidden; display: none !important; } /* Hide running indicator */
    [data-testid="stHeader"] { visibility: hidden; display: none !important; } /* Hide top header */
    </style>
""", unsafe_allow_html=True)

# ---------------------------------------------------------------------------
# Component: Back Button
# ---------------------------------------------------------------------------
def back_button():
    if st.button("← Back to Home", disabled=st.session_state.get("running", False)):
        nav_to("home")
        st.rerun()

# ---------------------------------------------------------------------------
# PAGES
# ---------------------------------------------------------------------------

def page_home():
    st.markdown("""
    <style>
    /* Style only the buttons rendered in this specific page */
    .stButton > button {
        aspect-ratio: 1 / 1;
        width: 100%;
        white-space: break-spaces;
        text-align: center;
        border-radius: 15px;
        border: 1px solid #d1d5db;
        transition: all 0.2s ease;
        background-color: #f0f2f6;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .stButton > button:hover {
        transform: translateY(-5px);
        border-color: #3b82f6;
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    }
    .dark-mode .stButton > button {
        background-color: #262730;
        border-color: #4b5563;
    }
    .stButton > button p {
        font-size: 1.6rem;
        font-weight: 600;
        color: inherit;
        margin: 0;
    }
    </style>
    """, unsafe_allow_html=True)
    
    st.title("🌊 WEC-RL Controller")
    st.markdown("Select an action below to get started.")
    
    c1, c2, c3, c4 = st.columns(4)
    
    with c1:
        if st.button("🏋️\nTrain Model", key="btn_train", use_container_width=True):
            nav_to("train")
            st.rerun()
            
    with c2:
        if st.button("🧪\nTest Model", key="btn_test", use_container_width=True):
            nav_to("test")
            st.rerun()
            
    with c3:
        if st.button("📊\nView Results", key="btn_results", use_container_width=True):
            nav_to("results")
            st.rerun()

    with c4:
        if st.button("🧠\nModels", key="btn_models", use_container_width=True):
            nav_to("models")
            st.rerun()

def page_train():
    back_button()
    st.title("🏋️ Train Model")
    
    cfg = load_config()
    controllers = get_available_controllers()
    
    _, center_col, _ = st.columns([1, 2, 1])
    
    with center_col:
        with st.container(border=True):
            st.subheader("⚙️ Configuration")
            client_mod = st.selectbox("Controller", controllers, index=0 if "rl" in controllers[0] else -1)
            is_rl = "rl" in client_mod.lower()
            
            control_mode = st.selectbox("Control Mode", ["latching", "linear"], 
                                        index=0 if cfg.get("control_mode") == "latching" else 1)
            sea_state = st.selectbox("Sea State", range(9), 
                                     format_func=lambda i: f"SS {i} (Hw={WAVE_HEIGHT_TABLE[i]}m, T={PERIOD_TABLE[i]}s)",
                                     index=cfg.get("init_SS_train", 5))
            
            mixed = st.toggle("Mixed Sea States", value=cfg.get("mixed_sea_state", True))
            regular = st.toggle("Regular Waves", value=cfg.get("regular", False))
            
            sim_time = st.number_input("Simulation Time (hours)", value=cfg.get("sim_time_train", 10.0), min_value=0.1, step=0.5)
            batch_size = st.number_input("Batch Size", value=cfg.get("batch_size", 1), min_value=1, step=1)
            
            if is_rl:
                ent_coef = st.number_input("Entropy Coefficient", value=cfg.get("ent_coef", 0.01), format="%.4f")
                retrain = st.toggle("Retrain (Fine-tune existing model)", value=cfg.get("retrain", False))
                retrain_path = ""
                if retrain:
                    all_models = scan_models()
                    options = ["(Custom Upload / Path)"] + all_models
                    
                    def_path = cfg.get("retrain_path_model", "")
                    idx = options.index(def_path) if def_path in options else 0
                    
                    selected_opt = st.selectbox("Select Model to Retrain", options, index=idx, format_func=lambda x: os.path.basename(x) if x != "(Custom Upload / Path)" else x)
                    
                    if selected_opt == "(Custom Upload / Path)":
                        uploaded_file = st.file_uploader("Browse/Upload Model File (.zip)", type=["zip", ""])
                        manual_path = st.text_input("Or enter exact absolute path manually:")
                        
                        if uploaded_file is not None:
                            os.makedirs("models/custom", exist_ok=True)
                            retrain_path = os.path.abspath(os.path.join("models/custom", uploaded_file.name))
                            with open(retrain_path, "wb") as f:
                                f.write(uploaded_file.getbuffer())
                            st.success("File ready!")
                        else:
                            retrain_path = manual_path
                    else:
                        retrain_path = selected_opt
        st.markdown("<br>", unsafe_allow_html=True)
        
        if st.session_state.get("running", False):
            execution_status_fragment()
        else:
            if st.session_state.get("sim_success", False):
                st.success("✅ Training completed successfully!")
                if st.button("📈 Go to View Results", use_container_width=True, type="primary"):
                    st.session_state["sim_success"] = False
                    nav_to("results")
                    st.rerun()
                if st.button("🔄 Start Another Training", use_container_width=True):
                    st.session_state["sim_success"] = False
                    st.rerun()
            else:
                if st.button("🚀 Start Training", use_container_width=True, type="primary"):
                    # Build config
                    new_cfg = load_config()
                    new_cfg.update({
                        "train_model": True,
                        "rl_control": is_rl,
                        "control_mode": control_mode,
                        "mixed_sea_state": mixed,
                        "regular": regular,
                        "save_mode": True,
                        "show_results": False,
                        "init_SS_train": sea_state,
                        "sim_time_train": sim_time,
                        "batch_size": int(batch_size)
                    })
                    if is_rl:
                        new_cfg["ent_coef"] = ent_coef
                        new_cfg["retrain"] = retrain
                        new_cfg["retrain_path_model"] = retrain_path
                    
                    if launch_simulation(new_cfg, client_mod):
                        st.rerun()

def page_test():
    back_button()
    st.title("🧪 Test Model")
    
    cfg = load_config()
    controllers = get_available_controllers()
    
    _, center_col, _ = st.columns([1, 2, 1])
    
    with center_col:
        with st.container(border=True):
            st.subheader("⚙️ Configuration")
            client_mod = st.selectbox("Controller", controllers)
            is_rl = "rl" in client_mod.lower()
            
            # 1. If RL, User must select a model first
            model_path = ""
            suggested_c_mode = "latching"
            suggested_reg = False
            suggested_ss = cfg.get("init_SS_test", 5)
    
            if is_rl:
                all_models = scan_models()
                options = ["(Custom Upload / Path)"] + all_models
                    
                def_path = st.session_state["selected_model"] if st.session_state["selected_model"] else cfg.get("path_model", "")
                idx = options.index(def_path) if def_path in options else 0
                
                selected_opt = st.selectbox("Select Model to Test", options, index=idx, format_func=lambda x: os.path.basename(x) if x != "(Custom Upload / Path)" else x)
                
                if selected_opt == "(Custom Upload / Path)":
                    uploaded_file = st.file_uploader("Browse/Upload Model File (.zip)", type=["zip", ""])
                    manual_path = st.text_input("Or enter exact absolute path manually:")
                    
                    if uploaded_file is not None:
                        os.makedirs("models/custom", exist_ok=True)
                        model_path = os.path.abspath(os.path.join("models/custom", uploaded_file.name))
                        with open(model_path, "wb") as f:
                            f.write(uploaded_file.getbuffer())
                        st.success("File ready!")
                    else:
                        model_path = manual_path
                else:
                    model_path = selected_opt
                
                # Infer parameters from the selected model's filename
                base_name = os.path.basename(model_path)
                if "_linear_" in base_name:
                    suggested_c_mode = "linear"
                if "_regular" in base_name and "_irregular" not in base_name:
                    suggested_reg = True
                    
                # Attempt to parse sea state (e.g. _2.9_11.5_)
                match = re.search(r'_([0-9]+\.[0-9]+)_([0-9]+\.[0-9]+)_', base_name)
                if match:
                    hw, p = float(match.group(1)), float(match.group(2))
                    for i, (w, t) in enumerate(zip(WAVE_HEIGHT_TABLE, PERIOD_TABLE)):
                        if abs(w - hw) < 0.01 and abs(t - p) < 0.01:
                            suggested_ss = i
                            break
    
            # 2. Other parameters (pre-filled with suggestions if RL)
            if not is_rl:
                suggested_c_mode = "latching" if cfg.get("control_mode") == "latching" else "linear"
                suggested_reg = cfg.get("regular", False)
                
            control_mode = st.selectbox("Control Mode", ["latching", "linear"], 
                                        index=0 if suggested_c_mode == "latching" else 1)
            sea_state = st.selectbox("Sea State", range(9), 
                                     format_func=lambda i: f"SS {i} (Hw={WAVE_HEIGHT_TABLE[i]}m, T={PERIOD_TABLE[i]}s)",
                                     index=suggested_ss)
            
            regular = st.toggle("Regular Waves", value=suggested_reg)
            sim_time = st.number_input("Simulation Time (seconds)", value=cfg.get("sim_time_test", 15.0), min_value=1.0, step=5.0)
            save_res = st.toggle("Save Results", value=cfg.get("save_mode", False))
            
        st.markdown("<br>", unsafe_allow_html=True)
        
        if st.session_state.get("running", False):
            execution_status_fragment()
        else:
            if st.session_state.get("sim_success", False):
                st.success("✅ Test completed successfully!")
                if st.button("📈 Go to View Results", use_container_width=True, type="primary"):
                    st.session_state["sim_success"] = False
                    nav_to("results")
                    st.rerun()
                if st.button("🔄 Start Another Test", use_container_width=True):
                    st.session_state["sim_success"] = False
                    st.rerun()
            else:
                if st.button("🚀 Start Testing", use_container_width=True, type="primary"):
                    new_cfg = load_config()
                    new_cfg.update({
                        "train_model": False,
                        "rl_control": is_rl,
                        "control_mode": control_mode,
                        "regular": regular,
                        "save_mode": save_res,
                        "show_results": False,
                        "init_SS_test": sea_state,
                        "sim_time_test": sim_time,
                    })
                    if is_rl:
                        new_cfg["path_model"] = model_path
                    
                    if launch_simulation(new_cfg, client_mod):
                        st.rerun()

def page_results():
    back_button()
    st.title("📊 View Results")
    
    view_type = st.radio("Select Section", ["Test Results", "Training Results"], horizontal=True)
    sub_dir = "test" if "Test" in view_type else "train"
    
    csv_files = scan_csv_results(sub_dir)
    
    if not csv_files:
        st.info(f"No CSV results found in `results/{sub_dir}`.")
        return
        
    rel_paths = [os.path.relpath(f, PROJECT_ROOT) for f in csv_files]
    chosen_idx = st.selectbox("Select Result File", range(len(rel_paths)), format_func=lambda i: rel_paths[i])
    chosen_csv = csv_files[chosen_idx]
    
    df = pd.read_csv(chosen_csv)
    
    st.subheader("Summary")
    c1, c2, c3 = st.columns(3)
    if "power_inst" in df.columns:
        c1.metric("Mean Power (W)", f"{df['power_inst'].mean():.2f}")
    if "position" in df.columns:
        c2.metric("Max Displacement (m)", f"{df['position'].abs().max():.4f}")
    if "velocity" in df.columns:
        c3.metric("Max Velocity (m/s)", f"{df['velocity'].abs().max():.4f}")

    if "time" in df.columns:
        st.subheader("Interactive Plot")
        plot_cols = [c for c in ["position", "velocity", "power_inst", "excitation_force"] if c in df.columns]
        if plot_cols:
            selected_signals = st.multiselect("Signals to plot", plot_cols, default=plot_cols[:3])
            if selected_signals:
                chart_df = df.set_index("time")[selected_signals]
                
                # Downsample if too large to prevent browser crash
                max_points = 2000
                if len(chart_df) > max_points:
                    step = len(chart_df) // max_points
                    chart_df = chart_df.iloc[::step]
                    st.caption(f"Showing downsampled data (1 point every {step} steps) to prevent browser crash.")
                    
                st.line_chart(chart_df)
                
    plot_png = find_matching_plot(chosen_csv)
    if plot_png:
        with st.expander("Saved PNG Plot"):
            st.image(plot_png)
            
    with st.expander("Raw Data (DataFrame)"):
        st.dataframe(df, use_container_width=True)

def page_models():
    back_button()
    st.title("🧠 Trained Models")
    
    model_files = scan_models()
    
    if not model_files:
        st.info("No trained models found under `models/`.")
        return
        
    # Group by regular/irregular
    grouped = {"irregular": [], "regular": []}
    for f in model_files:
        if "/irregular/" in f:
            grouped["irregular"].append(f)
        else:
            grouped["regular"].append(f)
            
    for wave_type, files in grouped.items():
        if not files:
            continue
            
        st.subheader(f"{wave_type.capitalize()} Wave Models")
        
        for f in files:
            rel = os.path.relpath(f, PROJECT_ROOT)
            sz = os.path.getsize(f) / (1024*1024)
            mtime = time.ctime(os.path.getmtime(f))
            
            with st.container(border=True):
                c1, c2 = st.columns([4, 1])
                with c1:
                    st.code(rel)
                    st.caption(f"Size: {sz:.2f} MB | Modified: {mtime}")
                with c2:
                    if st.button("Use for Testing", key=f"use_{f}"):
                        st.session_state["selected_model"] = f
                        nav_to("test")
                        st.rerun()

# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------
if st.session_state["page"] == "home":
    page_home()
elif st.session_state["page"] == "train":
    page_train()
elif st.session_state["page"] == "test":
    page_test()
elif st.session_state["page"] == "results":
    page_results()
elif st.session_state["page"] == "models":
    page_models()
