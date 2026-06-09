#!/bin/bash
# Stop all AITrader processes
ROOT="$(cd "$(dirname "$0")" && pwd)"
DASH_PID_FILE="$ROOT/.aitrader_dash.pid"
BOT_PID_FILE="$ROOT/.aitrader_bot.pid"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; RESET='\033[0m'
info()    { echo -e "${CYAN}[AITrader]${RESET} $*"; }
success() { echo -e "${GREEN}[AITrader]${RESET} $*"; }

info "Stopping AITrader…"

for pf in "$DASH_PID_FILE" "$BOT_PID_FILE"; do
  if [[ -f "$pf" ]]; then
    PID=$(cat "$pf" 2>/dev/null || true)
    if [[ -n "$PID" ]]; then
      kill -TERM "$PID" 2>/dev/null && info "Sent SIGTERM to PID $PID" || true
      sleep 1
      kill -KILL "$PID" 2>/dev/null || true
    fi
    rm -f "$pf"
  fi
done

# Belt-and-suspenders (also match "next-server" which is the actual process name)
pkill -KILL -f "mock_bot.py"  2>/dev/null || true
pkill -KILL -f "main.py"      2>/dev/null || true
pkill -KILL -f "next dev"     2>/dev/null || true
pkill -KILL -f "next-server"  2>/dev/null || true
rm -f /tmp/aitrader_mock_bot.lock

success "All stopped."
