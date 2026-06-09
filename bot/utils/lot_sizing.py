"""
Offline lot-size calculator for XAUUSD (mock / paper trading).
Uses the same risk formula as mt5_client without requiring MT5.
"""
from typing import Optional

# Typical FundedNext / MT5 XAUUSD contract specs
SYMBOL_SPECS = {
    "XAUUSD": {
        "contract_size": 100.0,  # oz per 1.0 lot
        "volume_min": 0.01,
        "volume_max": 50.0,
        "volume_step": 0.01,
    },
}


def calculate_lot_size(
    symbol: str,
    risk_pct: float,
    balance: float,
    entry: float,
    sl: float,
) -> float:
    specs = SYMBOL_SPECS.get(symbol, SYMBOL_SPECS["XAUUSD"])
    sl_distance = abs(entry - sl)
    if sl_distance == 0:
        return specs["volume_min"]

    risk_amount = balance * (risk_pct / 100.0)
    # $ loss per 1.0 lot at SL ≈ sl_distance × contract_size
    lot_size = risk_amount / (sl_distance * specs["contract_size"])

    lot_size = max(specs["volume_min"], min(lot_size, specs["volume_max"]))
    step = specs["volume_step"]
    return round(round(lot_size / step) * step, 2)


def calc_pnl(
    direction: str,
    entry: float,
    close_price: float,
    lot_size: float,
    symbol: str = "XAUUSD",
) -> float:
    """Unrealized or realized P&L in USD."""
    contract = SYMBOL_SPECS.get(symbol, SYMBOL_SPECS["XAUUSD"])["contract_size"]
    diff = close_price - entry
    if direction == "SELL":
        diff = -diff
    return round(diff * lot_size * contract, 2)
