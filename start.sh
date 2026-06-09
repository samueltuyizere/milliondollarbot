#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
#  AITrader — start dashboard + paper bot together
#  Usage: ./start.sh
#         ./start.sh --live    (live MT5 bot instead of paper)
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
DASHBOARD="$ROOT/dashboard"
BOT="$ROOT/bot"
PID_FILE="$ROOT/.aitrader.pids"
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

# ── Kill any leftover processes ───────────────────────────────────
cleanup() {
  echo ""
  info "Shutting down…"
  if [[ -f "$PID_FILE" ]]; then
    while IFS= read -r pid; do
      kill "$pid" 2>/dev/null && info "Stopped PID $pid" || true
    done < "$PID_FILE"
    rm -f "$PID_FILE"
  fi
  # Belt-and-suspenders: kill by name too
  pkill -f "next dev" 2>/dev/null || true
  pkill -f "mock_bot.py" 2>/dev/null || true
  pkill -f "main.py" 2>/dev/null || true
  success "All stopped. Goodbye."
}
trap cleanup EXIT INT TERM

# ── Check for already running instance ───────────────────────────
if [[ -f "$PID_FILE" ]]; then
  warn "Found existing .aitrader.pids — stopping old instance first…"
  cleanup
fi

echo ""
echo -e "${BOLD}╔══════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║   AITrader  ·  MillionDollarBot      ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════╝${RESET}"
echo ""

# ── 1. Dashboard ─────────────────────────────────────────────────
info "Starting dashboard on http://localhost:3000 …"
cd "$DASHBOARD"
node_modules/.bin/next dev --port 3000 > "$LOG_DASH" 2>&1 &
DASH_PID=$!
echo "$DASH_PID" >> "$PID_FILE"

# Wait for Next.js to be ready
for i in {1..30}; do
  if grep -q "Ready in" "$LOG_DASH" 2>/dev/null; then
    success "Dashboard ready  →  http://localhost:3000"
    break
  fi
  sleep 1
  if ! kill -0 "$DASH_PID" 2>/dev/null; then
    error "Dashboard failed to start. Check $LOG_DASH"
    exit 1
  fi
done

# ── 2. Bot ────────────────────────────────────────────────────────
cd "$BOT"
if [[ "$MODE" == "--live" ]]; then
  info "Starting LIVE MT5 bot…"
  warn "⚠  Live mode — real broker orders will be placed!"
  PYTHONUNBUFFERED=1 python3 -u main.py > "$LOG_BOT" 2>&1 &
else
  info "Starting paper bot (simulation)…"
  DEMO_LOOSE=1 PYTHONUNBUFFERED=1 python3 -u mock_bot.py > "$LOG_BOT" 2>&1 &
fi
BOT_PID=$!
echo "$BOT_PID" >> "$PID_FILE"

# Wait for bot to confirm startup
for i in {1..20}; do
  if grep -qE "(Paper bot starting|Mock bot starting|main.*starting)" "$LOG_BOT" 2>/dev/null; then
    success "Bot running  (PID $BOT_PID)"
    break
  fi
  sleep 1
  if ! kill -0 "$BOT_PID" 2>/dev/null; then
    error "Bot failed to start. Check $LOG_BOT"
    exit 1
  fi
done

# ── 3. Tail both logs ────────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "  Dashboard → ${CYAN}http://localhost:3000${RESET}"
echo -e "  Bot log   → ${CYAN}$LOG_BOT${RESET}"
echo -e "  Dash log  → ${CYAN}$LOG_DASH${RESET}"
echo -e "  Press ${BOLD}Ctrl+C${RESET} to stop everything"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""

# Stream bot log live (most useful output)
tail -f "$LOG_BOT" &
TAIL_PID=$!
echo "$TAIL_PID" >> "$PID_FILE"

# Keep script alive — also restart bot if it crashes
while true; do
  sleep 5
  if ! kill -0 "$BOT_PID" 2>/dev/null; then
    warn "Bot process died — restarting in 3s…"
    sleep 3
    cd "$BOT"
    if [[ "$MODE" == "--live" ]]; then
      PYTHONUNBUFFERED=1 python3 -u main.py >> "$LOG_BOT" 2>&1 &
    else
      DEMO_LOOSE=1 PYTHONUNBUFFERED=1 python3 -u mock_bot.py >> "$LOG_BOT" 2>&1 &
    fi
    BOT_PID=$!
    # Update PID file
    grep -v "^$BOT_PID$" "$PID_FILE" > "$PID_FILE.tmp" 2>/dev/null && mv "$PID_FILE.tmp" "$PID_FILE" || true
    echo "$BOT_PID" >> "$PID_FILE"
    success "Bot restarted (PID $BOT_PID)"
  fi
done
