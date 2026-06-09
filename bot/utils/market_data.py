"""
Live gold market data for mock/paper trading (no MT5 required).

Uses Yahoo Finance chart API with GC=F (COMEX gold futures) as the XAUUSD
proxy — tracks spot gold within a few dollars and provides reliable H1 OHLCV.
"""
import time
from typing import Optional
import pandas as pd
import requests

from utils.logger import log

# COMEX gold futures ≈ XAUUSD spot for strategy/backtesting purposes
YAHOO_TICKERS = {
    "XAUUSD": "GC=F",
    "GOLD": "GC=F",
}

INTERVAL_MAP = {
    "M1": "1m",
    "M5": "5m",
    "M15": "15m",
    "M30": "30m",
    "H1": "60m",
    "H4": "240m",
    "D1": "1d",
}

RANGE_MAP = {
    "1m": "7d",
    "5m": "60d",
    "15m": "60d",
    "30m": "60d",
    "60m": "60d",
    "240m": "730d",
    "1d": "max",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; AITrader/1.0)",
}

_cache: dict = {}
CACHE_TTL = 45


def _yahoo_ticker(symbol: str) -> str:
    return YAHOO_TICKERS.get(symbol.upper(), "GC=F")


def _fetch_chart(ticker: str, interval: str, range_: str) -> Optional[pd.DataFrame]:
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
    try:
        r = requests.get(
            url,
            params={"interval": interval, "range": range_},
            headers=HEADERS,
            timeout=15,
        )
        r.raise_for_status()
        payload = r.json()
    except Exception as e:
        log("ERROR", "market", f"Yahoo chart request failed: {e}")
        return None

    result = payload.get("chart", {}).get("result")
    if not result:
        err = payload.get("chart", {}).get("error", {})
        log("WARNING", "market", f"No chart data for {ticker}: {err}")
        return None

    block = result[0]
    timestamps = block.get("timestamp") or []
    quote = (block.get("indicators", {}).get("quote") or [{}])[0]

    if not timestamps or not quote.get("close"):
        return None

    df = pd.DataFrame({
        "time": pd.to_datetime(timestamps, unit="s", utc=True),
        "open": quote.get("open"),
        "high": quote.get("high"),
        "low": quote.get("low"),
        "close": quote.get("close"),
        "volume": quote.get("volume"),
    })

    df = df.dropna(subset=["open", "high", "low", "close"])
    return df


def get_ohlcv(symbol: str, timeframe_str: str, bars: int = 200) -> Optional[pd.DataFrame]:
    """
    Returns OHLCV DataFrame: time, open, high, low, close, volume (ascending).
    Compatible with strategy.ema_pullback.check_signal().
    """
    cache_key = (symbol, timeframe_str, bars)
    now = time.time()
    if cache_key in _cache:
        cached_df, cached_at = _cache[cache_key]
        if now - cached_at < CACHE_TTL:
            return cached_df.copy()

    interval = INTERVAL_MAP.get(timeframe_str.upper(), "60m")
    range_ = RANGE_MAP.get(interval, "60d")
    ticker = _yahoo_ticker(symbol)

    df = _fetch_chart(ticker, interval, range_)
    if df is None or df.empty:
        return _cache.get(cache_key, (None, 0))[0]

    df = df.tail(bars).reset_index(drop=True)
    _cache[cache_key] = (df, now)

    last = float(df.iloc[-1]["close"])
    log("DEBUG", "market", f"{symbol} ({ticker}) {timeframe_str}: {len(df)} bars, last={last:.2f}")
    return df


def get_current_price(symbol: str) -> Optional[float]:
    """Latest gold price from Yahoo chart meta."""
    ticker = _yahoo_ticker(symbol)
    try:
        r = requests.get(
            f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}",
            params={"interval": "1m", "range": "1d"},
            headers=HEADERS,
            timeout=10,
        )
        r.raise_for_status()
        result = r.json()["chart"]["result"][0]
        meta = result.get("meta", {})
        price = meta.get("regularMarketPrice") or meta.get("previousClose")
        if price and price > 0:
            return round(float(price), 2)
    except Exception as e:
        log("WARNING", "market", f"Live price fetch failed: {e}")

    df = get_ohlcv(symbol, "H1", bars=3)
    if df is not None and len(df) > 0:
        return round(float(df.iloc[-1]["close"]), 2)
    return None
