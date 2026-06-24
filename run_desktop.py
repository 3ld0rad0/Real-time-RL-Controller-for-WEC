import subprocess
import time
import socket
import sys
import os
import shutil

def wait_for_port(port=8501, timeout=15):
    """Attende finché la porta specificata non accetta connessioni."""
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            with socket.create_connection(('localhost', port), timeout=1):
                return True
        except OSError:
            time.sleep(0.5)
    return False

def start_streamlit():
    """Avvia il server Streamlit in modalità headless."""
    return subprocess.Popen(
        [sys.executable, "-m", "streamlit", "run", "src/gui/app.py", "--server.headless", "true"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

def open_app_mode(url):
    """Apre un browser in modalità 'App' (senza barra URL e tab) per simulare un programma desktop."""
    # Path comuni su WSL
    edge_wsl = "/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
    chrome_wsl = "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe"
    chrome_wsl_alt = "/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"
    
    browser_proc = None
    if os.path.exists(edge_wsl):
        browser_proc = subprocess.Popen([edge_wsl, f"--app={url}"])
    elif os.path.exists(chrome_wsl):
        browser_proc = subprocess.Popen([chrome_wsl, f"--app={url}"])
    elif os.path.exists(chrome_wsl_alt):
        browser_proc = subprocess.Popen([chrome_wsl_alt, f"--app={url}"])
    elif shutil.which("google-chrome"):
        browser_proc = subprocess.Popen(["google-chrome", f"--app={url}"])
    elif shutil.which("chromium-browser"):
        browser_proc = subprocess.Popen(["chromium-browser", f"--app={url}"])
    elif shutil.which("microsoft-edge"):
        browser_proc = subprocess.Popen(["microsoft-edge", f"--app={url}"])
    else:
        # Fallback: apre una normale tab del browser di default
        import webbrowser
        webbrowser.open(url)
    
    return browser_proc

if __name__ == '__main__':
    print("Avvio del server Streamlit in background...")
    proc = start_streamlit()
    
    if wait_for_port(8501):
        print("Streamlit avviato. Apertura della finestra Desktop...")
        browser_proc = open_app_mode('http://localhost:8501')
        
        try:
            if browser_proc:
                browser_proc.wait() # Aspetta che la finestra venga chiusa
            else:
                proc.wait() # Se non possiamo tracciare il browser, aspetta CTRL+C
        except KeyboardInterrupt:
            pass
    else:
        print("Errore: Streamlit non è partito in tempo.")
    
    print("Chiusura dell'applicazione e spegnimento del server...")
    proc.terminate()
    proc.wait()
