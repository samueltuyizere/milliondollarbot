"""
MT5 execution layer.
All MT5 operations go through this module.
"""
import os
import time
from typing import Optional, List
import pandas as pd
import MetaTrader5 as mt5
from utils.logger import log


def connect() -> bool:
    if not mt5.initialize():
        log("ERROR", "mt5", f"MT5 initialize() failed: {mt5.last_error()}")
        return False
    log("INFO", "mt5", f"MT5 connected: {mt5.terminal_info().name}")
    return True


def disconnect():
    mt5.shutdown()
    log("INFO", "mt5", "MT5 disconnected")


def get_account_info() -> Optional[dict]:
    info = mt5.account_info()
    if info is None:
        log("ERROR", "mt5", f"account_info() failed: {mt5.last_error()}")
        return None
    return {
        "balance": info.balance,
        "equity": info.equity,
        "margin": info.margin,
        "free_margin": info.margin_free,
        "profit": info.profit,
        "leverage": info.leverage,
        "currency": info.currency,
    }


def get_ohlcv(symbol: str, timeframe_str: str, bars: int = 200) -> Optional[pd.DataFrame]:
    tf_map = {
        "M1": mt5.TIMEFRAME_M1, "M5": mt5.TIMEFRAME_M5, "M15": mt5.TIMEFRAME_M15,
        "M30": mt5.TIMEFRAME_M30, "H1": mt5.TIMEFRAME_H1, "H4": mt5.TIMEFRAME_H4,
        "D1": mt5.TIMEFRAME_D1,
    }
    tf = tf_map.get(timeframe_str, mt5.TIMEFRAME_H1)
    rates = mt5.copy_rates_from_pos(symbol, tf, 0, bars)
    if rates is None or len(rates) == 0:
        log("ERROR", "mt5", f"Failed to get rates for {symbol} {timeframe_str}")
        return None

    df = pd.DataFrame(rates)
    df["time"] = pd.to_datetime(df["time"], unit="s")
    df = df.rename(columns={"tick_volume": "volume"})[["time", "open", "high", "low", "close", "volume"]]
    return df


def calculate_lot_size(symbol: str, risk_pct: float, balance: float, entry: float, sl: float) -> float:
    """
    Calculate lot size based on risk %.
    risk_amount = balance * risk_pct / 100
    lot_size = risk_amount / (pip_value_per_lot * sl_pips)
    """
    symbol_info = mt5.symbol_info(symbol)
    if symbol_info is None:
        log("ERROR", "mt5", f"symbol_info() failed for {symbol}")
        return 0.01

    sl_distance = abs(entry - sl)
    if sl_distance == 0:
        return 0.01

    risk_amount = balance * (risk_pct / 100)
    point = symbol_info.point
    tick_size = symbol_info.trade_tick_size
    tick_value = symbol_info.trade_tick_value

    if tick_size == 0:
        return 0.01

    sl_in_ticks = sl_distance / tick_size
    lot_size = risk_amount / (sl_in_ticks * tick_value)

    # Clamp to min/max
    lot_size = max(symbol_info.volume_min, min(lot_size, symbol_info.volume_max))
    # Round to step
    step = symbol_info.volume_step
    lot_size = round(round(lot_size / step) * step, 2)

    return lot_size


def place_order(
    symbol: str,
    direction: str,
    lot_size: float,
    entry: float,
    sl: float,
    tp: float,
    comment: str = "AITrader",
    magic: int = 20240608,
    retries: int = 3,
) -> Optional[dict]:
    order_type = mt5.ORDER_TYPE_BUY if direction == "BUY" else mt5.ORDER_TYPE_SELL

    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol,
        "volume": lot_size,
        "type": order_type,
        "sl": sl,
        "tp": tp,
        "comment": comment,
        "magic": magic,
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }

    for attempt in range(1, retries + 1):
        result = mt5.order_send(request)
        if result is None:
            log("ERROR", "mt5", f"order_send() returned None (attempt {attempt})")
            time.sleep(1)
            continue

        if result.retcode == mt5.TRADE_RETCODE_DONE:
            log("INFO", "mt5", f"Order placed: ticket={result.order} {direction} {symbol} {lot_size} lots")
            return {
                "ticket": result.order,
                "direction": direction,
                "symbol": symbol,
                "lot_size": lot_size,
                "entry": result.price,
                "sl": sl,
                "tp": tp,
                "retcode": result.retcode,
            }

        log("WARNING", "mt5", f"Order failed attempt {attempt}: retcode={result.retcode} comment={result.comment}")

        if result.retcode in (
            mt5.TRADE_RETCODE_REQUOTE,
            mt5.TRADE_RETCODE_PRICE_CHANGED,
            mt5.TRADE_RETCODE_OFF_QUOTES,
        ):
            # Refresh price and retry
            tick = mt5.symbol_info_tick(symbol)
            if tick:
                request["price"] = tick.ask if direction == "BUY" else tick.bid
            time.sleep(0.5)
        else:
            break

    log("ERROR", "mt5", f"Order FAILED after {retries} attempts: {direction} {symbol}")
    return None


def get_open_positions(symbol: Optional[str] = None, magic: int = 20240608) -> list:
    positions = mt5.positions_get(symbol=symbol) if symbol else mt5.positions_get()
    if positions is None:
        return []
    return [
        {
            "ticket": p.ticket,
            "symbol": p.symbol,
            "direction": "BUY" if p.type == 0 else "SELL",
            "lot_size": p.volume,
            "entry": p.price_open,
            "sl": p.sl,
            "tp": p.tp,
            "profit": p.profit,
            "swap": p.swap,
        }
        for p in positions
        if p.magic == magic
    ]


def close_position(ticket: int, symbol: str, direction: str, lot_size: float) -> bool:
    close_type = mt5.ORDER_TYPE_SELL if direction == "BUY" else mt5.ORDER_TYPE_BUY
    tick = mt5.symbol_info_tick(symbol)
    price = tick.bid if direction == "BUY" else tick.ask

    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol,
        "volume": lot_size,
        "type": close_type,
        "position": ticket,
        "price": price,
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
        "comment": "AITrader close",
    }

    result = mt5.order_send(request)
    if result and result.retcode == mt5.TRADE_RETCODE_DONE:
        log("INFO", "mt5", f"Position {ticket} closed @ {price}")
        return True

    log("ERROR", "mt5", f"Failed to close position {ticket}: {result.comment if result else 'None'}")
    return False
