"""
Mock Bot — paper trading on macOS/Linux without MT5.

Uses LIVE gold prices (Yahoo GC=F ≈ XAUUSD) and the same pipeline as main.py:
  - H1 EMA pullback strategy (ema_pullback.py)
  - Full RiskGuard (risk_guard.py)
  - Risk-based lot sizing (lot_sizing.py)
  - Paper positions closed when live price hits SL/TP

Run with: python mock_bot.py
"""
import os
import sys
import time
import signal as _signal
from dotenv import load_dotenv

load_dotenv()

BOT_MODE = "mock"

# Block MT5 import on non-Windows
import unittest.mock as mock
sys.modules["MetaTrader5"] = mock.MagicMock()

from config import load_bot_config, get_bot_command
from strategy.ema_pullback import check_signal
from risk.risk_guard import RiskGuard
from utils.market_data import get_ohlcv, get_current_price
from utils.lot_sizing import calculate_lot_size, calc_pnl
from utils.db_writer import report_trade_opened, report_trade_closed, send_heartbeat, restore_session_state
from utils.logger import log

POLL_SECONDS = int(os.environ.get("POLL_SECONDS", "15"))
HEARTBEAT_SECONDS = int(os.environ.get("HEARTBEAT_SECONDS", "10"))

running = True
peak_equity: float = 0.0
today_pnl: float = 0.0
last_heartbeat = 0.0


def _init_ticket_seq() -> int:
    """Start mock ticket sequence after the highest existing paper ticket in the DB."""
    try:
        import requests
        api = os.environ.get("DASHBOARD_API_URL", "http://localhost:3000")
        r = requests.get(f"{api}/api/trades?limit=1000", timeout=5)
        trades = r.json().get("trades", [])
        paper_tickets = [
            t["mt5Ticket"] for t in trades
            if t.get("mt5Ticket") and t["mt5Ticket"] >= 900_000
        ]
        if paper_tickets:
            return max(paper_tickets)
    except Exception:
        pass
    return 900_000


mock_ticket_seq = _init_ticket_seq()

# trade_id → paper position
open_trades: dict[str, dict] = {}


def graceful_shutdown(signum, frame):
    global running
    log("INFO", "mock", "Shutdown — stopping paper bot…")
    running = False


_signal.signal(_signal.SIGTERM, graceful_shutdown)
_signal.signal(_signal.SIGINT, graceful_shutdown)


def _floating_pnl(symbol: str, price: float) -> float:
    return sum(
        calc_pnl(t["direction"], t["entry"], price, t["lot_size"], symbol)
        for t in open_trades.values()
    )


def _check_paper_exits(symbol: str, price: float, high: float, low: float):
    """Close paper positions when live price touches SL or TP."""
    global today_pnl

    for trade_id, pos in list(open_trades.items()):
        direction = pos["direction"]
        sl, tp = pos["sl"], pos["tp"]
        hit = None
        close_price = price

        if direction == "BUY":
            if low <= sl:
                hit, close_price = "SL", sl
            elif high >= tp:
                hit, close_price = "TP", tp
        else:
            if high >= sl:
                hit, close_price = "SL", sl
            elif low <= tp:
                hit, close_price = "TP", tp

        if not hit:
            continue

        pnl = calc_pnl(direction, pos["entry"], close_price, pos["lot_size"], symbol)
        today_pnl += pnl
        report_trade_closed(trade_id, close_price, pnl)
        del open_trades[trade_id]
        log(
            "INFO",
            "mock",
            f"Paper {hit} hit: {direction} @ {pos['entry']:.2f} → {close_price:.2f} | P&L ${pnl:+.2f}",
        )


def _check_manual_close_requests(symbol: str, price: float) -> bool:
    """Returns True if any trade was manually closed this cycle."""
    """Poll the dashboard for any open trades flagged for manual close and close them."""
    global today_pnl
    if not open_trades:
        return False
    try:
        from utils.db_writer import _session, DASHBOARD_URL
        r = _session.get(f"{DASHBOARD_URL}/api/trades?status=OPEN&limit=50", timeout=5)
        flagged = [t for t in r.json().get("trades", []) if t.get("manualClose")]
    except Exception as e:
        log("WARNING", "mock", f"Manual close check failed: {e}")
        return False

    closed_any = False
    for t in flagged:
        trade_id = t["id"]
        if trade_id in open_trades:
            pos = open_trades[trade_id]
            del open_trades[trade_id]
        else:
            # Trade flagged but not in our dict (e.g. from a previous session)
            pos = {
                "direction": t.get("direction", "BUY"),
                "entry":     t.get("entryPrice", price),
                "lot_size":  t.get("lotSize", 0.0),
            }
        pnl = calc_pnl(pos["direction"], pos["entry"], price, pos["lot_size"], symbol)
        report_trade_closed(trade_id, price, pnl)
        today_pnl += pnl
        closed_any = True
        log(
            "INFO",
            "mock",
            f"Manual close: {pos['direction']} @ {pos['entry']:.2f} → {price:.2f} | P&L ${pnl:+.2f}",
        )
    return closed_any


def _open_paper_trade(cfg: dict, signal: dict, lot_size: float) -> None:
    global mock_ticket_seq

    mock_ticket_seq += 1
    trade_id = report_trade_opened(
        account_id=cfg["account_id"],
        signal=signal,
        ticket=mock_ticket_seq,
        lot_size=lot_size,
    )
    if trade_id:
        open_trades[trade_id] = {
            "entry": signal["entry"],
            "sl": signal["sl"],
            "tp": signal["tp"],
            "direction": signal["direction"],
            "lot_size": lot_size,
        }
        log(
            "INFO",
            "mock",
            f"Paper order: {signal['direction']} {signal['symbol']} @ {signal['entry']:.2f} "
            f"| SL {signal['sl']:.2f} TP {signal['tp']:.2f} | {lot_size} lots",
        )


def _cleanup_orphaned_trades(symbol: str, price: float) -> None:
    """
    On startup, any trade that is OPEN in the DB but not in our in-memory
    open_trades dict is an orphan from a previous hard-killed session.
    Close them at the current market price so the bot can trade freely.
    """
    try:
        from utils.db_writer import _session, DASHBOARD_URL
        r = _session.get(f"{DASHBOARD_URL}/api/trades?status=OPEN&limit=100", timeout=5)
        orphans = r.json().get("trades", [])
    except Exception as e:
        log("WARNING", "mock", f"Orphan check failed: {e}")
        return

    if not orphans:
        return

    for t in orphans:
        trade_id = t["id"]
        entry    = t.get("entryPrice", price)
        lot_size = t.get("lotSize", 0.0)
        direction = t.get("direction", "BUY")
        pnl = calc_pnl(direction, entry, price, lot_size, symbol)
        report_trade_closed(trade_id, price, pnl)
        log(
            "WARNING",
            "mock",
            f"Orphan closed: {direction} @ {entry:.2f} → {price:.2f} | P&L ${pnl:+.2f} (hard-kill recovery)",
        )


def main():
    global peak_equity, today_pnl, last_heartbeat, running

    log("INFO", "mock", "Paper bot starting — live XAUUSD data + real strategy")

    try:
        cfg = load_bot_config()
    except RuntimeError as e:
        log("CRITICAL", "mock", str(e))
        sys.exit(1)

    symbol = cfg["symbol"]
    base_balance = cfg.get("balance", 200_000.0)

    # Restore today_pnl, all-time P&L and peak equity from closed trade history
    state = restore_session_state(base_balance)
    today_pnl = state["today_pnl"]
    balance = base_balance + state["total_pnl"]
    peak_equity = state["peak_equity"]

    # Verify market data is available
    probe = get_current_price(symbol)
    if probe is None:
        log("CRITICAL", "mock", "Cannot fetch live XAUUSD price. Check internet / pip install yfinance")
        sys.exit(1)

    log("INFO", "mock", f"Live {symbol} ≈ ${probe:,.2f} | Balance ${balance:,.2f} | Today P&L ${today_pnl:+.2f} | {cfg['timeframe']}")

    # Close any positions left open by a previous hard-killed session
    _cleanup_orphaned_trades(symbol, probe)

    while running:
        try:
            cfg = load_bot_config()
            symbol = cfg["symbol"]
            base_balance = cfg.get("balance", base_balance)
            guard = RiskGuard(cfg)

            cmd = get_bot_command()

            if cmd == "STOPPED":
                price = get_current_price(symbol) or balance
                equity = balance + today_pnl + _floating_pnl(symbol, price)
                send_heartbeat(
                    equity, balance, today_pnl, peak_equity,
                    len(open_trades), "STOPPED", bot_mode=BOT_MODE,
                )
                time.sleep(10)
                continue

            if cmd in ("DAILY_LOCK", "ERROR"):
                price = get_current_price(symbol) or balance
                equity = balance + today_pnl + _floating_pnl(symbol, price)
                send_heartbeat(
                    equity, balance, today_pnl, peak_equity,
                    len(open_trades), cmd, bot_mode=BOT_MODE,
                )
                time.sleep(30)
                continue

            if cmd == "PAUSED":
                price = get_current_price(symbol) or balance
                equity = balance + today_pnl + _floating_pnl(symbol, price)
                send_heartbeat(
                    equity, balance, today_pnl, peak_equity,
                    len(open_trades), "PAUSED", bot_mode=BOT_MODE,
                )
                time.sleep(10)
                continue

            # ── Live price + OHLCV ────────────────────────────────────────────
            price = get_current_price(symbol)
            df = get_ohlcv(symbol, cfg["timeframe"], bars=200)

            if price is None or df is None or len(df) < 60:
                log("WARNING", "mock", "Waiting for market data…")
                time.sleep(POLL_SECONDS)
                continue

            last_bar = df.iloc[-1]
            bar_high = float(last_bar["high"])
            bar_low = float(last_bar["low"])

            # Check paper SL/TP against latest bar range + current price
            _check_paper_exits(symbol, price, max(price, bar_high), min(price, bar_low))

            # Check for manual close requests from the dashboard
            manual_closed = _check_manual_close_requests(symbol, price)

            equity = balance + today_pnl + _floating_pnl(symbol, price)
            if equity > peak_equity:
                peak_equity = equity

            now = time.time()
            if now - last_heartbeat >= HEARTBEAT_SECONDS:
                send_heartbeat(
                    equity, balance, today_pnl, peak_equity,
                    len(open_trades), "RUNNING", bot_mode=BOT_MODE,
                )
                last_heartbeat = now

            # ── Strategy (same as main.py) ──────────────────────────────────
            if manual_closed:
                time.sleep(POLL_SECONDS)
                continue

            if len(open_trades) >= cfg["max_open_trades"]:
                time.sleep(POLL_SECONDS)
                continue

            signal = check_signal(df, cfg)
            if not signal:
                time.sleep(POLL_SECONDS)
                continue

            log("INFO", "strategy", f"Signal: {signal}")

            allowed, reason = guard.check_all(
                entry=signal["entry"],
                sl=signal["sl"],
                tp=signal["tp"],
                direction=signal["direction"],
                open_trades_count=len(open_trades),
                equity=equity,
                floating_pnl=_floating_pnl(symbol, price),
            )

            if not allowed:
                log("WARNING", "risk", f"Signal rejected: {reason}")
                time.sleep(POLL_SECONDS)
                continue

            lot_size = calculate_lot_size(
                symbol=symbol,
                risk_pct=cfg["risk_per_trade_pct"],
                balance=balance,
                entry=signal["entry"],
                sl=signal["sl"],
            )

            signal["symbol"] = symbol
            _open_paper_trade(cfg, signal, lot_size)

        except KeyboardInterrupt:
            break
        except Exception as e:
            log("ERROR", "mock", f"Loop error: {e}")
            time.sleep(5)

        time.sleep(POLL_SECONDS)

    # Cleanup open paper trades at shutdown
    sym = cfg["symbol"]
    price = get_current_price(sym) or 0
    for trade_id, pos in list(open_trades.items()):
        if price > 0:
            pnl = calc_pnl(pos["direction"], pos["entry"], price, pos["lot_size"], sym)
            report_trade_closed(trade_id, price, pnl)
    open_trades.clear()

    final_equity = base_balance + state["total_pnl"] + today_pnl
    send_heartbeat(final_equity, balance, today_pnl, peak_equity, 0, "STOPPED", bot_mode=BOT_MODE)
    log("INFO", "mock", "Paper bot stopped.")


if __name__ == "__main__":
    main()
