"""
H1 EMA Pullback Strategy for XAUUSD

Signal logic:
  1. Trend filter: price above EMA_slow → bullish bias (long only in Phase 1)
  2. Pullback: price pulls back to or below EMA_fast
  3. RSI confirmation: RSI < rsi_oversold (dip in bullish trend)
  4. Entry: candle closes back above EMA_fast (confirmation candle)
  5. SL: entry - (ATR * atr_multi_sl)
  6. TP: entry + (SL_distance * min_rr)

Returns a Signal dict or None.
"""
import os
from typing import Optional
import pandas as pd
import numpy as np


def compute_indicators(df: pd.DataFrame, cfg: dict) -> pd.DataFrame:
    """Adds EMA, RSI, ATR columns to OHLCV dataframe."""
    ema_fast = cfg["ema_fast"]
    ema_slow = cfg["ema_slow"]
    rsi_period = cfg["rsi_period"]
    atr_period = cfg["atr_period"]

    df = df.copy()

    # EMA
    df["ema_fast"] = df["close"].ewm(span=ema_fast, adjust=False).mean()
    df["ema_slow"] = df["close"].ewm(span=ema_slow, adjust=False).mean()

    # RSI
    delta = df["close"].diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(com=rsi_period - 1, min_periods=rsi_period).mean()
    avg_loss = loss.ewm(com=rsi_period - 1, min_periods=rsi_period).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    df["rsi"] = 100 - (100 / (1 + rs))

    # ATR
    df["tr"] = pd.concat([
        df["high"] - df["low"],
        (df["high"] - df["close"].shift()).abs(),
        (df["low"] - df["close"].shift()).abs(),
    ], axis=1).max(axis=1)
    df["atr"] = df["tr"].ewm(com=atr_period - 1, min_periods=atr_period).mean()

    return df


def check_signal(df: pd.DataFrame, cfg: dict) -> Optional[dict]:
    """
    Returns a signal dict if conditions are met, else None.
    df must have columns: open, high, low, close, volume (OHLCV)
    and must be sorted ascending by time.
    """
    df = compute_indicators(df, cfg)

    if len(df) < max(cfg["ema_slow"], cfg["rsi_period"]) + 5:
        return None

    prev = df.iloc[-2]   # confirmed previous candle
    curr = df.iloc[-1]   # latest closed candle

    # Direction: long only in Phase 1
    long_only = cfg.get("long_only", True)

    # Demo mode: relax thresholds so a paper trade fires quickly.
    # Enabled only when env DEMO_LOOSE=1 (mock bot) — never in live trading.
    demo_loose = os.environ.get("DEMO_LOOSE") == "1"

    # ─── LONG signal ──────────────────────────────────────────────────────────
    if demo_loose:
        # Fire a long on every opportunity so a paper trade appears immediately.
        bullish_trend = True
        pullback_touched = True
        rsi_dip = True
        confirmation_close = True
    else:
        bullish_trend = curr["close"] > curr["ema_slow"]
        pullback_touched = prev["low"] <= prev["ema_fast"]
        rsi_dip = prev["rsi"] < cfg["rsi_oversold"]
        confirmation_close = curr["close"] > curr["ema_fast"]

    if bullish_trend and pullback_touched and rsi_dip and confirmation_close:
        entry = curr["close"]
        sl_distance = curr["atr"] * cfg["atr_multi_sl"]
        # Small R:R buffer in demo mode so rounding never trips the guard's min_rr check.
        rr = cfg["min_rr"] + (0.3 if demo_loose else 0.0)
        sl = entry - sl_distance
        tp = entry + (sl_distance * rr)

        return {
            "direction": "BUY",
            "entry": round(entry, 2),
            "sl": round(sl, 2),
            "tp": round(tp, 2),
            "atr": round(curr["atr"], 2),
            "rsi": round(prev["rsi"], 1),
            "ema_fast": round(curr["ema_fast"], 2),
            "ema_slow": round(curr["ema_slow"], 2),
        }

    # ─── SHORT signal (disabled in long_only mode) ────────────────────────────
    if not long_only:
        bearish_trend = curr["close"] < curr["ema_slow"]
        pullback_up = prev["high"] >= prev["ema_fast"]
        rsi_overbought = prev["rsi"] > (100 - cfg["rsi_oversold"])
        confirmation_down = curr["close"] < curr["ema_fast"]

        if bearish_trend and pullback_up and rsi_overbought and confirmation_down:
            entry = curr["close"]
            sl_distance = curr["atr"] * cfg["atr_multi_sl"]
            sl = entry + sl_distance
            tp = entry - (sl_distance * cfg["min_rr"])

            return {
                "direction": "SELL",
                "entry": round(entry, 2),
                "sl": round(sl, 2),
                "tp": round(tp, 2),
                "atr": round(curr["atr"], 2),
                "rsi": round(prev["rsi"], 1),
                "ema_fast": round(curr["ema_fast"], 2),
                "ema_slow": round(curr["ema_slow"], 2),
            }

    return None
