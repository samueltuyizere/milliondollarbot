"""
AITrader Main Loop — XAUUSD H1 EMA Pullback Bot

Execution flow (per iteration):
  1. Read config from local DB
  2. Check bot command (start/stop/pause from dashboard)
  3. Send heartbeat to dashboard
  4. If RUNNING: check for signals
  5. If signal: run all risk checks
  6. If risk approved: place MT5 order, log trade
  7. Monitor open positions for manual close/TP/SL hit

Run with: python main.py
"""
import os
import sys
import time
import signal as _signal
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

from config import load_bot_config, get_bot_command
from strategy.ema_pullback import check_signal
from risk.risk_guard import RiskGuard
from utils.mt5_client import (
    connect, disconnect, get_account_info, get_ohlcv,
    calculate_lot_size, place_order, get_open_positions, close_position,
)
from utils.db_writer import report_trade_opened, report_trade_closed, send_heartbeat, restore_session_state
from utils.logger import log

# ─── State ────────────────────────────────────────────────────────────────────

running = True
open_trade_map: dict[int, str] = {}  # mt5_ticket → dashboard trade_id
peak_equity: float = 0.0
today_pnl: float = 0.0
POLL_SECONDS = int(os.environ.get("POLL_SECONDS", "15"))
HEARTBEAT_SECONDS = int(os.environ.get("HEARTBEAT_SECONDS", "10"))
last_heartbeat = 0.0


def graceful_shutdown(signum, frame):
    global running
    log("INFO", "main", "Shutdown signal received — stopping bot gracefully…")
    running = False


_signal.signal(_signal.SIGTERM, graceful_shutdown)
_signal.signal(_signal.SIGINT, graceful_shutdown)


# ─── Main loop ────────────────────────────────────────────────────────────────

def main():
    global peak_equity, today_pnl, last_heartbeat

    log("INFO", "main", "AITrader bot starting…")

    if not connect():
        log("CRITICAL", "main", "Cannot connect to MT5. Exiting.")
        sys.exit(1)

    try:
        cfg = load_bot_config()
    except RuntimeError as e:
        log("CRITICAL", "main", str(e))
        disconnect()
        sys.exit(1)

    log("INFO", "main", f"Config loaded: {cfg['symbol']} {cfg['timeframe']} account={cfg['account_id']}")
    guard = RiskGuard(cfg)
    symbol = cfg["symbol"]

    while running:
        try:
            # ── Reload config every loop (picks up dashboard changes) ──────────
            cfg = load_bot_config()
            guard = RiskGuard(cfg)

            # ── Dashboard command check ────────────────────────────────────────
            cmd = get_bot_command()
            if cmd == "STOPPED":
                _send_hb(peak_equity, cfg, status="STOPPED")
                time.sleep(10)
                continue
            if cmd in ("DAILY_LOCK", "ERROR"):
                log("WARNING", "main", f"Bot state: {cmd} — waiting…")
                _send_hb(peak_equity, cfg, status=cmd)
                time.sleep(30)
                continue
            if cmd == "PAUSED":
                _send_hb(peak_equity, cfg, status="PAUSED")
                time.sleep(10)
                continue

            # ── Account info ──────────────────────────────────────────────────
            acct = get_account_info()
            if not acct:
                log("ERROR", "main", "Cannot get account info from MT5")
                time.sleep(5)
                continue

            equity = acct["equity"]
            balance = acct["balance"]

            # Track peak equity (for drawdown calc)
            if equity > peak_equity:
                peak_equity = equity

            # ── Heartbeat ─────────────────────────────────────────────────────
            now = time.time()
            if now - last_heartbeat >= HEARTBEAT_SECONDS:
                open_pos = get_open_positions(symbol=symbol)
                _update_open_trades(open_pos, acct)
                send_heartbeat(
                    equity=equity,
                    balance=balance,
                    daily_pnl=today_pnl,
                    peak_equity=peak_equity,
                    open_trades=len(open_pos),
                    status="RUNNING",
                )
                last_heartbeat = now

            # ── Monitor open positions ────────────────────────────────────────
            open_pos = get_open_positions(symbol=symbol)
            _check_closed_positions(open_pos)
            manual_closed = _check_manual_close_requests(symbol, open_pos)

            # ── Strategy signal check ─────────────────────────────────────────
            if manual_closed:
                time.sleep(POLL_SECONDS)
                continue

            if len(open_pos) >= cfg["max_open_trades"]:
                time.sleep(POLL_SECONDS)
                continue

            df = get_ohlcv(symbol, cfg["timeframe"], bars=200)
            if df is None or len(df) < 60:
                log("WARNING", "main", "Not enough bars")
                time.sleep(POLL_SECONDS)
                continue

            signal = check_signal(df, cfg)
            if not signal:
                time.sleep(POLL_SECONDS)
                continue

            log("INFO", "strategy", f"Signal: {signal}")

            # ── Risk gate ─────────────────────────────────────────────────────
            floating_pnl = sum(p.get("profit", 0.0) for p in open_pos)
            allowed, reason = guard.check_all(
                entry=signal["entry"],
                sl=signal["sl"],
                tp=signal["tp"],
                direction=signal["direction"],
                open_trades_count=len(open_pos),
                equity=equity,
                floating_pnl=floating_pnl,
            )

            if not allowed:
                log("WARNING", "risk", f"Signal rejected: {reason}")
                time.sleep(POLL_SECONDS)
                continue

            # ── Execute order ─────────────────────────────────────────────────
            lot_size = calculate_lot_size(
                symbol=symbol,
                risk_pct=cfg["risk_per_trade_pct"],
                balance=balance,
                entry=signal["entry"],
                sl=signal["sl"],
            )

            signal["symbol"] = symbol
            order = place_order(
                symbol=symbol,
                direction=signal["direction"],
                lot_size=lot_size,
                entry=signal["entry"],
                sl=signal["sl"],
                tp=signal["tp"],
            )

            if order:
                trade_id = report_trade_opened(
                    account_id=cfg["account_id"],
                    signal=signal,
                    ticket=order["ticket"],
                    lot_size=lot_size,
                )
                if trade_id:
                    open_trade_map[order["ticket"]] = trade_id
                log("INFO", "main", f"Order placed: ticket={order['ticket']}")
            else:
                log("ERROR", "main", "Order placement failed")

        except KeyboardInterrupt:
            break
        except Exception as e:
            log("ERROR", "main", f"Loop error: {e}", metadata={"exc": str(e)})
            time.sleep(5)

        time.sleep(POLL_SECONDS)

    log("INFO", "main", "Bot stopped.")
    disconnect()


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _send_hb(peak: float, cfg: dict, status: str = "RUNNING"):
    acct = get_account_info()
    if acct:
        open_pos = get_open_positions(symbol=cfg.get("symbol", "XAUUSD"))
        send_heartbeat(
            equity=acct["equity"],
            balance=acct["balance"],
            daily_pnl=today_pnl,
            peak_equity=peak,
            open_trades=len(open_pos),
            status=status,
        )


def _update_open_trades(positions: list, acct: dict):
    global today_pnl
    today_pnl = sum(p["profit"] for p in positions)


def _check_manual_close_requests(symbol: str, open_pos: list) -> bool:
    """Check dashboard for trades flagged manualClose=true and close them via MT5. Returns True if any closed."""
    from utils.db_writer import _session, DASHBOARD_URL
    try:
        r = _session.get(f"{DASHBOARD_URL}/api/trades?status=OPEN&limit=50", timeout=5)
        flagged = [t for t in r.json().get("trades", []) if t.get("manualClose")]
    except Exception as e:
        log("WARNING", "main", f"Manual close check failed: {e}")
        return False

    if not flagged:
        return False

    pos_by_ticket = {p["ticket"]: p for p in open_pos}
    closed_any = False

    for t in flagged:
        trade_id = t["id"]
        mt5_ticket = t.get("mt5Ticket")

        if mt5_ticket and mt5_ticket in pos_by_ticket:
            pos = pos_by_ticket[mt5_ticket]
            success = close_position(
                ticket=mt5_ticket,
                symbol=symbol,
                direction=t["direction"],
                lot_size=pos["volume"],
            )
            if success:
                del open_trade_map[mt5_ticket]
                closed_any = True
        else:
            # Not found in MT5 — close in DB only (already closed at broker)
            report_trade_closed(trade_id, t.get("entryPrice", 0), 0)
            closed_any = True

    return closed_any


def _check_closed_positions(current_open: list):
    """Detect positions that have closed since last check and report them."""
    global today_pnl
    current_tickets = {p["ticket"] for p in current_open}

    for ticket, trade_id in list(open_trade_map.items()):
        if ticket not in current_tickets:
            # Position closed — find close details from MT5 history
            from_date = datetime(2020, 1, 1, tzinfo=timezone.utc)
            import MetaTrader5 as mt5
            deals = mt5.history_deals_get(from_date, datetime.now(timezone.utc), position=ticket)
            close_price = 0.0
            pnl = 0.0
            commission = 0.0
            swap = 0.0

            if deals:
                for d in deals:
                    if d.entry == 1:  # OUT deal
                        close_price = d.price
                        pnl = d.profit
                        commission = d.commission
                        swap = d.swap

            report_trade_closed(trade_id, close_price, pnl, commission, swap)
            today_pnl += pnl
            del open_trade_map[ticket]
            log("INFO", "main", f"Position {ticket} closed: pnl=${pnl:.2f}")


if __name__ == "__main__":
    main()
