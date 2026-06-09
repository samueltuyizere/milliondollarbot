#!/bin/bash
# ─────────────────────────────────────────────────────────────────
#  AITrader — start dashboard + paper bot together
#  Usage: ./start.sh
#         ./start.sh --live    (live MT5 bot instead of paper)
#  Processes are daemonized (survive terminal close / shell exit).
#  Run ./stop.sh to stop everything.
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

export NEXT_TELEMETRY_DISABLED=1

ROOT="$(cd "$(dirname "$0")" && pwd)"
DASHBOARD="$ROOT/dashboard"
BOT="$ROOT/bot"
PID_DIR="$ROOT"
DASH_PID_FILE="$PID_DIR/.aitrader_dash.pid"
BOT_PID_FILE="$PID_DIR/.aitrader_bot.pid"
LOG_BOT="/tmp/aitrader_bot.log"
LOG_DASH="/tmp/aitrader_dash.log"
MODE="${1:-}"

# ── Colours ──────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[AITrader]${RESET} $*"; }
success() { echo -e "${GREEN}[AITrader]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[AITrader]${RESET} $*"; }
error()   { echo -e "${RED}[AITrader]${RESET} $*"; }

# ── Find Python with all bot dependencies ─────────────────────────
_find_python() {
  for py in \
    "${AITRADER_PYTHON:-}" \
    /usr/local/bin/python3.13 \
    /usr/local/bin/python3 \
    /opt/homebrew/bin/python3 \
    python3
  do
    [[ -z "$py" ]] && continue
    if command -v "$py" &>/dev/null && "$py" -c "import psycopg2" 2>/dev/null; then
      echo "$py"; return
    fi
  done
  echo "python3"
}
PYTHON="$(_find_python)"
info "Using Python: $PYTHON ($($PYTHON --version 2>&1))"

# ── Stop any existing instances ────────────────────────────────────
_stop_existing() {
  for pf in "$DASH_PID_FILE" "$BOT_PID_FILE"; do
    if [[ -f "$pf" ]]; then
      OLD_PID=$(cat "$pf" 2>/dev/null || true)
      if [[ -n "$OLD_PID" ]]; then
        kill -TERM "$OLD_PID" 2>/dev/null || true
        sleep 1
        kill -KILL "$OLD_PID" 2>/dev/null || true
      fi
      rm -f "$pf"
    fi
  done
  # Belt-and-suspenders (also match "next-server" which is the actual process name)
  pkill -KILL -f "mock_bot.py"  2>/dev/null || true
  pkill -KILL -f "main.py"      2>/dev/null || true
  pkill -KILL -f "next dev"     2>/dev/null || true
  pkill -KILL -f "next-server"  2>/dev/null || true
  # Remove mock bot lock file
  rm -f /tmp/aitrader_mock_bot.lock
}

if [[ -f "$DASH_PID_FILE" ]] || [[ -f "$BOT_PID_FILE" ]]; then
  warn "Stopping existing AITrader instance first…"
  _stop_existing
  sleep 2
else
  # Still kill any strays (e.g. from manual starts or crashed runs)
  pkill -KILL -f "mock_bot.py"  2>/dev/null || true
  pkill -KILL -f "next dev"     2>/dev/null || true
  pkill -KILL -f "next-server"  2>/dev/null || true
  rm -f /tmp/aitrader_mock_bot.lock
  sleep 1
fi

echo ""
echo -e "${BOLD}╔══════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║   AITrader  ·  MillionDollarBot      ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════╝${RESET}"
echo ""

# ── Helper: daemonize a command (double-fork via Python) ──────────
# Usage: _daemonize <pidfile> <logfile> <cwd> <cmd> [args...]
_daemonize() {
  local pidfile="$1" logfile="$2" cwd="$3"
  shift 3
  local cmd=("$@")

  "$PYTHON" - "$pidfile" "$logfile" "$cwd" "${cmd[@]}" <<'PYEOF'
import os, sys, subprocess

pidfile = sys.argv[1]
logfile = sys.argv[2]
cwd     = sys.argv[3]
cmd     = sys.argv[4:]

# Use subprocess.Popen with start_new_session=True (calls setsid() after fork).
# This creates a new process group / session so the child is immune to SIGHUP
# when the parent shell exits, without the architecture side-effects of a
# manual double-fork on macOS M1 (multi-threaded fork resets to x86_64).
  with open(logfile, 'a') as log_f:
    p = subprocess.Popen(
        cmd,
        cwd=cwd,
        stdout=log_f,
        stderr=subprocess.STDOUT,
        stdin=subprocess.DEVNULL,
        start_new_session=True,   # new process group + session; immune to SIGHUP
        env={**os.environ},
    )

  with open(pidfile, 'w') as f:
      f.write(str(p.pid))
PYEOF
}

# ── 1. Dashboard ──────────────────────────────────────────────────
info "Starting dashboard (daemonized)…"
> "$LOG_DASH"
# arch -arm64: forces arm64 slice of Node.js.
# Python (used for start_new_session Popen) may be x86_64-only on this Mac,
# which would cause Node (a universal binary) to also run as x86_64 and fail
# to load the arm64 SWC compiler. arch -arm64 overrides this.
_daemonize "$DASH_PID_FILE" "$LOG_DASH" "$DASHBOARD" \
  arch -arm64 node_modules/.bin/next dev --port 3000

# Wait until port 3000 accepts connections (max 45s)
DASH_READY=0
for i in {1..90}; do
  sleep 0.5
  if nc -z localhost 3000 2>/dev/null; then
    # Warmup request to prevent idle SWC crash on first connection
    curl -s http://localhost:3000/api/bot/status -o /dev/null 2>/dev/null || true
    DASH_PID=$(cat "$DASH_PID_FILE" 2>/dev/null || echo "?")
    success "Dashboard ready  →  http://localhost:3000  (PID $DASH_PID)"
    DASH_READY=1
    break
  fi
done
if [[ "$DASH_READY" -eq 0 ]]; then
  error "Dashboard did not start in time. Check $LOG_DASH"
  exit 1
fi

# ── 2. Bot ────────────────────────────────────────────────────────
info "Starting bot (daemonized)…"
> "$LOG_BOT"
if [[ "$MODE" == "--live" ]]; then
  warn "⚠  Live mode — real broker orders will be placed!"
  _daemonize "$BOT_PID_FILE" "$LOG_BOT" "$BOT" \
    "$PYTHON" -u main.py
else
  # Python is x86_64-only; that's fine for a script-only bot.
  # Pass DEMO_LOOSE via the environment dict inside _daemonize's Popen call.
  _daemonize "$BOT_PID_FILE" "$LOG_BOT" "$BOT" \
    env DEMO_LOOSE=1 PYTHONUNBUFFERED=1 "$PYTHON" -u mock_bot.py
fi

# Wait for bot startup confirmation (max 20s)
for i in {1..40}; do
  sleep 0.5
  if grep -qE "(Paper bot starting|Live bot starting|main.*starting)" "$LOG_BOT" 2>/dev/null; then
    BOT_PID=$(cat "$BOT_PID_FILE" 2>/dev/null || echo "?")
    success "Bot running  (PID $BOT_PID)"
    break
  fi
done

# ── 3. Summary ───────────────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "  Dashboard → ${CYAN}http://localhost:3000${RESET}"
echo -e "  Bot log   → ${CYAN}tail -f $LOG_BOT${RESET}"
echo -e "  Dash log  → ${CYAN}tail -f $LOG_DASH${RESET}"
echo -e "  Stop      → ${CYAN}./stop.sh${RESET}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
info "Both processes are daemonized — this shell can now close safely."
info "To monitor: tail -f $LOG_BOT"
