import psutil
import os
import signal

def kill_process_on_port(port):
    found = False
    for conn in psutil.net_connections(kind='inet'):
        if conn.laddr.port == port:
            pid = conn.pid
            if pid:
                try:
                    proc = psutil.Process(pid)
                    print(f"Found process {proc.name()} (PID: {pid}) on port {port}.")
                    
                    # Terminate gracefully
                    proc.terminate()
                    proc.wait(timeout=3)
                    print(f"Process {pid} terminated.")
                    found = True
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    print(f"Could not kill process {pid}. You might need sudo/admin rights.")
                except psutil.TimeoutExpired:
                    # Force kill if it doesn't close
                    print(f"Process {pid} didn't close in time. Forcing kill...")
                    proc.kill()
                    found = True

    if not found:
        print(f"No process found running on port {port}.")

if __name__ == "__main__":
    TARGET_PORT = 5173
    kill_process_on_port(TARGET_PORT)
