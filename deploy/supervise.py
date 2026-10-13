"""Run the loopback OCR service and Next server together; fail if either exits."""
import os
import signal
import subprocess
import time

children=[]
stopping=False

def stop(_signal=None,_frame=None):
    global stopping
    stopping=True
    for child in children:
        if child.poll() is None: child.terminate()

signal.signal(signal.SIGTERM,stop)
signal.signal(signal.SIGINT,stop)
subprocess.run(['node','scripts/migrate.mjs'],check=True)
children.append(subprocess.Popen(['/opt/ocr/bin/uvicorn','app:app','--app-dir','/app/ocr','--host','127.0.0.1','--port','8000','--workers','1']))
children.append(subprocess.Popen(['node','server.js']))
exit_code=0
try:
    while not stopping:
        if any(child.poll() is not None for child in children):
            exit_code=1
            stop()
            break
        time.sleep(.2)
finally:
    stop()
    for child in children:
        try: child.wait(timeout=10)
        except subprocess.TimeoutExpired:
            child.kill()
            child.wait()
raise SystemExit(exit_code)
