import subprocess
import sys

def run():
    print("Starting Audit...")
    try:
        result = subprocess.run(
            [sys.executable, ".agent/skills/frontend-design/scripts/ux_audit.py", "."],
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='ignore'
        )
        print("STDOUT:")
        print(result.stdout)
        print("STDERR:")
        print(result.stderr)
        print(f"EXIT CODE: {result.returncode}")
    except Exception as e:
        print(f"FAILED: {e}")

if __name__ == "__main__":
    run()
