"""
Writes trade data to the local DB and reports to the dashboard API.
"""
import os
from typing import Optional
import requests
from utils.logger import log

DASHBOARD_URL = os.environ.get("DASHBOARD_URL", "http://localhost:3000")
_session = requests.Session()


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


def send_heartbeat(equity: float, balance: float, daily_pnl: float, peak_equity: float,
                   open_trades: int, status: str = "RUNNING", error_msg: str = None):
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
            },
            timeout=3,
        )
    except Exception:
        pass  # Non-critical
