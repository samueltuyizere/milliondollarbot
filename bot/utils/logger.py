"""
Dual logger: writes to local DB (system_logs) AND stdout.
Also pushes logs to the dashboard API (/api/logs/system).
"""
import os
import sys
import json
import requests
from datetime import datetime, timezone


DASHBOARD_URL = os.environ.get("DASHBOARD_URL", "http://localhost:3000")
_BOT_SECRET = os.environ.get("BOT_SECRET", "")

_session = requests.Session()
if _BOT_SECRET:
    _session.headers.update({"X-Bot-Secret": _BOT_SECRET})


def log(level: str, source: str, message: str, metadata: dict = None):
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {level:8s} [{source}] {message}", file=sys.stderr if level in ("ERROR", "CRITICAL") else sys.stdout)

    try:
        _session.post(
            f"{DASHBOARD_URL}/api/logs/system",
            json={"level": level, "source": source, "message": message, "metadata": metadata},
            timeout=2,
        )
    except Exception:
        pass  # Don't crash the bot if the dashboard is unreachable
