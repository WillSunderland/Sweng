import json
from datetime import datetime

LOG_FILE = "audit_logs.jsonl"


def log_audit(log_data):
    try:
        log_data["logged_at"] = datetime.utcnow().isoformat()

        with open(LOG_FILE, "a") as f:
            f.write(json.dumps(log_data) + "\n")

    except Exception as e:
        print(f"[AUDIT LOG ERROR] {e}")