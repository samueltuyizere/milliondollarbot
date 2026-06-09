"""
Writes trade data to the local DB and reports to the dashboard API.
"""
import os
from typing import Optional
import requests
from utils.logger import log

DASHBOARD_URL = os.environ.get("DASHBOARD_URL", "http://localhost:3000")
_BOT_SECRET = os.environ.get("BOT_SECRET", "")

_session = requests.Session()
if _BOT_SECRET:
    _session.headers.update({"X-Bot-Secret": _BOT_SECRET})


def report_trade_opened(account_id: str, signal: dict, ticket: int, lot_size: float) -> Optional[str]:
    """POST /api/trades — returns trade ID from dashboard."""
    try:
        r = _session.post(
            f"{DASHBOARD_URL}/api/trades",
            json={
                "accountId": account_id,
                "symbol": signal.get("symbol", "XAUUSD"),
                "direction": signal["direction"],
                "entryPrice": signal["entry"],
                "stopLoss": signal["sl"],
                "takeProfit": signal["tp"],
                "lotSize": lot_size,
                "mt5Ticket": ticket,
            },
            timeout=5,
        )
        data = r.json()
        if data.get("ok"):
            return data["trade"]["id"]
        log("ERROR", "db", f"report_trade_opened failed: {data.get('error')}")
    except Exception as e:
        log("ERROR", "db", f"report_trade_opened exception: {e}")
    return None


def report_trade_closed(trade_id: str, close_price: float, pnl: float, commission: float = 0, swap: float = 0):
    """POST /api/trades/{id}/close"""
    try:
        r = _session.post(
            f"{DASHBOARD_URL}/api/trades/{trade_id}/close",
            json={"closePrice": close_price, "pnl": pnl, "commission": commission, "swap": swap},
            timeout=5,
        )
        data = r.json()
        if not data.get("ok"):
            log("ERROR", "db", f"report_trade_closed failed: {data.get('error')}")
    except Exception as e:
        log("ERROR", "db", f"report_trade_closed exception: {e}")


def restore_session_state(base_balance: float) -> dict:
    """
    Query closed trade history from the dashboard and return:
      - today_pnl    : sum of PnL for trades closed today (UTC)
      - total_pnl    : sum of PnL across all closed trades (to offset base balance)
      - peak_equity  : historical equity peak (base_balance + max running cumulative PnL)

    Returns a dict with keys today_pnl, total_pnl, peak_equity.
    Falls back to zeros if the API is unreachable.
    """
    from datetime import datetime, timezone
    result = {"today_pnl": 0.0, "total_pnl": 0.0, "peak_equity": base_balance}
    try:
        r = _session.get(f"{DASHBOARD_URL}/api/trades?limit=10000", timeout=5)
        trades = r.json().get("trades", [])

        closed_statuses = {"CLOSED_WIN", "CLOSED_LOSS", "CLOSED_BE"}
        closed = [t for t in trades if t.get("status") in closed_statuses and t.get("pnl") is not None]

        # Sort by closeTime ascending to compute running equity peak
        closed.sort(key=lambda t: t.get("closeTime") or t.get("createdAt") or "")

        today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        running_pnl = 0.0
        today_pnl = 0.0

        for t in closed:
            pnl = float(t["pnl"])
            running_pnl += pnl
            current_equity = base_balance + running_pnl
            if current_equity > result["peak_equity"]:
                result["peak_equity"] = current_equity

            close_time = t.get("closeTime") or ""
            if close_time.startswith(today_str):
                today_pnl += pnl

        result["total_pnl"] = running_pnl
        result["today_pnl"] = today_pnl

        log("INFO", "db", (
            f"Session restored — today P&L: ${today_pnl:+.2f} | "
            f"all-time P&L: ${running_pnl:+.2f} | "
            f"peak equity: ${result['peak_equity']:,.2f}"
        ))
    except Exception as e:
        log("WARNING", "db", f"Could not restore session state: {e}")
    return result


def send_heartbeat(equity: float, balance: float, daily_pnl: float, peak_equity: float,
                   open_trades: int, status: str = "RUNNING", error_msg: str = None,
                   bot_mode: str = "live"):
    """POST /api/bot/heartbeat"""
    try:
        dd_pct = ((peak_equity - equity) / peak_equity * 100) if peak_equity and peak_equity > 0 else 0
        _session.post(
            f"{DASHBOARD_URL}/api/bot/heartbeat",
            json={
                "status": status,
                "equity": equity,
                "balance": balance,
                "dailyPnl": daily_pnl,
                "peakEquity": peak_equity,
                "drawdownPct": dd_pct,
                "openTrades": open_trades,
                "errorMsg": error_msg,
                "botMode": bot_mode,
            },
            timeout=3,
        )
    except Exception:
        pass  # Non-critical
