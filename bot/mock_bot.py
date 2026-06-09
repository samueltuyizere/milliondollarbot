"""
Mock Bot — runs on macOS/Linux without MT5.
Simulates realistic XAUUSD trading activity so you can fully test the dashboard.

Behaviour:
  - Reads config from local DB (same as real bot)
  - Sends heartbeats every 10s with simulated equity/P&L
  - Opens a fake BUY trade every ~60s when RUNNING
  - Closes each fake trade after ~90s with random P&L
  - Respects Start/Stop/Pause commands from dashboard
  - Applies the same risk gate (daily lock, drawdown, R:R)

Run with: python mock_bot.py
"""

import os
import sys
import time
import random
import signal as _signal
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

# Patch out MT5 before importing anything that might import it
import unittest.mock as mock
sys.modules["MetaTrader5"] = mock.MagicMock()

from config import load_bot_config, get_bot_command
from utils.db_writer import report_trade_opened, report_trade_closed, send_heartbeat
from utils.logger import log

# ─── Sim state ────────────────────────────────────────────────────────────────

GOLD_BASE = 2340.0          # Base XAUUSD price
running = True
peak_equity = 0.0
today_pnl = 0.0

# Active fake trades: {dashboard_trade_id: {entry, sl, tp, direction, open_time, lot_size}}
open_trades: dict = {}


def graceful_shutdown(signum, frame):
    global running
    log("INFO", "mock", "Shutdown — stopping mock bot…")
    running = False


_signal.signal(_signal.SIGTERM, graceful_shutdown)
_signal.signal(_signal.SIGINT, graceful_shutdown)


# ─── Sim helpers ──────────────────────────────────────────────────────────────

def sim_price() -> float:
    """Slowly drifting gold price with noise."""
    global GOLD_BASE
    GOLD_BASE += random.uniform(-1.5, 1.5)
    return round(GOLD_BASE + random.uniform(-0.5, 0.5), 2)


def sim_equity(balance: float) -> float:
    open_profit = sum(
        (t["direction"] == "BUY" and 1 or -1) *
        (sim_price() - t["entry"]) * t["lot_size"] * 100
        for t in open_trades.values()
    )
    return round(balance + today_pnl + open_profit, 2)


def generate_signal(cfg: dict) -> dict:
    price = sim_price()
    atr = round(random.uniform(8, 18), 2)
    sl_distance = round(atr * cfg.get("atr_multi_sl", 1.5), 2)
    min_rr = cfg.get("min_rr", 2.0)

    return {
        "direction": "BUY",
        "entry": price,
        "sl": round(price - sl_distance, 2),
        "tp": round(price + sl_distance * min_rr, 2),
        "symbol": "XAUUSD",
        "atr": atr,
        "rsi": round(random.uniform(30, 42), 1),
    }


# ─── Main loop ────────────────────────────────────────────────────────────────

def main():
    global peak_equity, today_pnl, running

    log("INFO", "mock", "Mock bot starting (macOS — no MT5)")

    try:
        cfg = load_bot_config()
    except RuntimeError as e:
        log("CRITICAL", "mock", str(e))
        sys.exit(1)

    balance = cfg.get("balance", 500000.0)
    equity = balance
    peak_equity = balance
    account_id = cfg["account_id"]

    HEARTBEAT_EVERY = 5       # seconds between heartbeats
    SIGNAL_EVERY = 45         # seconds between trade signals
    CLOSE_AFTER = 90          # seconds before auto-close
    last_hb = 0.0
    last_signal = 0.0
    iteration = 0

    log("INFO", "mock", f"Account ${balance:,.0f} | Symbol {cfg['symbol']} | R:R {cfg['min_rr']}")

    while running:
        try:
            # ── Reload config each loop ────────────────────────────────────────
            cfg = load_bot_config()
            balance = cfg.get("balance", balance)

            # ── Dashboard command ──────────────────────────────────────────────
            cmd = get_bot_command()

            if cmd == "STOPPED":
                # Process stays alive — just idle until user clicks Start in dashboard
                send_heartbeat(equity, balance, today_pnl, peak_equity, len(open_trades), "STOPPED")
                time.sleep(5)
                continue

            if cmd in ("DAILY_LOCK", "ERROR"):
                send_heartbeat(equity, balance, today_pnl, peak_equity, len(open_trades), cmd)
                time.sleep(10)
                continue

            if cmd == "PAUSED":
                send_heartbeat(equity, balance, today_pnl, peak_equity, len(open_trades), "PAUSED")
                time.sleep(5)
                continue

            # ── Simulate equity drift ──────────────────────────────────────────
            equity = sim_equity(balance)
            if equity > peak_equity:
                peak_equity = equity

            # ── Auto-close old fake trades ─────────────────────────────────────
            now = time.time()
            to_close = [
                tid for tid, t in open_trades.items()
                if now - t["open_time"] >= CLOSE_AFTER
            ]
            for tid in to_close:
                t = open_trades.pop(tid)
                close_price = sim_price()
                # 55% win rate with realistic P&L
                win = random.random() < 0.55
                if win:
                    close_price = t["tp"] + random.uniform(-2, 2)
                    pnl = round((close_price - t["entry"]) * t["lot_size"] * 100, 2)
                else:
                    close_price = t["sl"] + random.uniform(-1, 1)
                    pnl = round((close_price - t["entry"]) * t["lot_size"] * 100, 2)

                today_pnl += pnl
                report_trade_closed(tid, round(close_price, 2), pnl)
                log("INFO", "mock", f"Trade closed: pnl=${pnl:+.2f} | today total=${today_pnl:+.2f}")

            # ── Heartbeat ─────────────────────────────────────────────────────
            if now - last_hb >= HEARTBEAT_EVERY:
                send_heartbeat(equity, balance, today_pnl, peak_equity, len(open_trades), "RUNNING")
                last_hb = now

            # ── Signal check (only when RUNNING and under trade limit) ─────────
            max_trades = cfg.get("max_open_trades", 1)
            if len(open_trades) < max_trades and now - last_signal >= SIGNAL_EVERY:
                signal = generate_signal(cfg)

                # Quick risk check
                daily_loss_limit = balance * (cfg.get("max_daily_loss_pct", 1.0) / 100)
                if today_pnl <= -daily_loss_limit:
                    log("WARNING", "mock", f"Daily loss limit hit (${today_pnl:.2f}). Skipping signal.")
                    last_signal = now
                    time.sleep(2)
                    continue

                # Mock lot size (0.1–0.5 range)
                lot_size = round(random.uniform(0.1, 0.3), 2)

                trade_id = report_trade_opened(
                    account_id=account_id,
                    signal=signal,
                    ticket=random.randint(100000, 999999),
                    lot_size=lot_size,
                )

                if trade_id:
                    open_trades[trade_id] = {
                        "entry": signal["entry"],
                        "sl": signal["sl"],
                        "tp": signal["tp"],
                        "direction": signal["direction"],
                        "lot_size": lot_size,
                        "open_time": now,
                    }
                    log("INFO", "mock", f"Mock trade opened: {signal['direction']} @ {signal['entry']} | SL:{signal['sl']} TP:{signal['tp']}")

                last_signal = now

        except KeyboardInterrupt:
            break
        except Exception as e:
            log("ERROR", "mock", f"Loop error: {e}")
            time.sleep(3)

        iteration += 1
        time.sleep(2)

    # Cleanup: close any remaining fake trades
    for tid, t in list(open_trades.items()):
        pnl = round(random.uniform(-200, 400), 2)
        report_trade_closed(tid, sim_price(), pnl)

    send_heartbeat(equity, balance, today_pnl, peak_equity, 0, "STOPPED")
    log("INFO", "mock", "Mock bot stopped.")


if __name__ == "__main__":
    main()
