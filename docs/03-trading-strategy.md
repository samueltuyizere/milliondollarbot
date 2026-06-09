# 03 — Trading Strategy

> **Source:** `bot/strategy/ema_pullback.py`. Parameters come from the `strategy_configs` table (see [08 — Configuration](./08-configuration-reference.md)).

## 3.1 Strategy in one sentence

> In an uptrend, wait for price to dip back to the fast moving average with cooled momentum, then buy when it closes back above that average — risking a fixed ATR‑based stop for at least double the reward.

This is a classic **trend‑pullback (buy‑the‑dip‑in‑an‑uptrend)** approach. It is **long‑only** in Phase 1.

---

## 3.2 Indicators

All indicators are computed on **H1 (1‑hour) candles** in `compute_indicators()`.

| Indicator | Default period | Formula notes |
|-----------|----------------|---------------|
| **EMA fast** | 21 | `close.ewm(span=21, adjust=False).mean()` |
| **EMA slow** | 50 | `close.ewm(span=50, adjust=False).mean()` |
| **RSI** | 14 | Wilder‑style: `avg_gain/avg_loss` via `ewm(com=period-1)`, then `100 − 100/(1+RS)` |
| **ATR** | 14 | True Range = max(H−L, \|H−prevClose\|, \|L−prevClose\|); ATR = `TR.ewm(com=period-1).mean()` |

The function needs at least `max(ema_slow, rsi_period) + 5` candles (≈ 55) before it will evaluate a signal; it requests 200 bars.

Two candles drive the decision:
- **`prev`** = the last *fully closed* prior candle (`df.iloc[-2]`) — used for the pullback and RSI conditions.
- **`curr`** = the latest closed candle (`df.iloc[-1]`) — used for the trend and confirmation conditions.

---

## 3.3 Entry conditions (LONG)

A **BUY** signal is generated only when **all four** conditions are true:

| # | Condition | Code | Meaning |
|---|-----------|------|---------|
| 1 | **Bullish trend** | `curr.close > curr.ema_slow` | Price is above the slow EMA → uptrend bias |
| 2 | **Pullback touched** | `prev.low <= prev.ema_fast` | The prior candle dipped to/below the fast EMA → a pullback occurred |
| 3 | **RSI dip** | `prev.rsi < rsi_oversold` (default 40) | Momentum cooled on the pullback → not chasing |
| 4 | **Confirmation close** | `curr.close > curr.ema_fast` | Price closed back above the fast EMA → bounce confirmed |

```
        ema_slow (50)
   price ─────────────────────────────  ← (1) price above slow EMA = uptrend
              ╲      ╱ confirmation close above ema_fast (4)
               ╲   ╱
   ema_fast(21)─╲─╱──────  ← (2) prev candle dips to/below fast EMA (pullback)
                 v  RSI < 40 here (3)
```

When all four hold:

```python
entry      = curr.close
sl_distance = curr.atr * atr_multi_sl          # default 1.5 × ATR
sl         = entry - sl_distance
tp         = entry + (sl_distance * min_rr)    # default 2.0 × risk
```

The returned signal dict contains: `direction="BUY"`, `entry`, `sl`, `tp`, plus diagnostic fields (`atr`, `rsi`, `ema_fast`, `ema_slow`), all rounded to 2 decimals.

---

## 3.4 Exit logic (SL / TP)

The strategy does **not** poll for exits itself — exits are handled where execution happens:

- **Live (`main.py`):** SL and TP are attached to the MT5 order. MT5 closes the position; the bot detects the close via `_check_closed_positions()` and reports it.
- **Mock (`mock_bot.py`):** `_check_paper_exits()` compares the live price (and the latest bar's high/low) against each open position's SL/TP:
  - **BUY:** close at `sl` if `low <= sl`; close at `tp` if `high >= tp`.
- **Manual:** the user can close any open position from the dashboard at the current market price.

Risk:reward is fixed at entry, so a winning trade returns ≥ `min_rr` × the amount risked.

---

## 3.5 Worked example

Assume H1 XAUUSD with the defaults (EMA 21/50, RSI 14, ATR 14, `atr_multi_sl=1.5`, `min_rr=2.0`):

| Field | Value |
|-------|-------|
| `curr.ema_slow` | 4,350.00 |
| `curr.close` | 4,353.70 → **> ema_slow ✓ (bullish)** |
| `prev.low` | 4,348.00, `prev.ema_fast` 4,349.00 → **low ≤ fast EMA ✓ (pullback)** |
| `prev.rsi` | 38.0 → **< 40 ✓ (RSI dip)** |
| `curr.ema_fast` | 4,352.00 → `curr.close 4,353.70 > 4,352.00` **✓ (confirmation)** |
| `curr.atr` | 15.50 |

Computed order:

```
sl_distance = 15.50 × 1.5            = 23.25
entry       = 4,353.70
sl          = 4,353.70 − 23.25       = 4,330.45
tp          = 4,353.70 + 23.25 × 2.0 = 4,400.20
risk:reward = (4400.20 − 4353.70) / (4353.70 − 4330.45) = 46.50 / 23.25 = 2.0 ✓
```

Lot size is then derived from the risk percentage and the 23.25 stop distance (see [04 — Risk Management](./04-risk-management.md#lot-sizing)).

---

## 3.6 Short side (disabled)

A mirror‑image **SELL** path exists in `check_signal()` but only runs when `long_only = False` (the schema default is `true`, so it is **off** in Phase 1). For completeness, the short conditions are:

| # | Condition |
|---|-----------|
| 1 | `curr.close < curr.ema_slow` (downtrend) |
| 2 | `prev.high >= prev.ema_fast` (pullback up to fast EMA) |
| 3 | `prev.rsi > (100 − rsi_oversold)` → default `> 60` (overbought) |
| 4 | `curr.close < curr.ema_fast` (confirmation down) |

SL is placed above entry, TP below, using `min_rr`.

---

## 3.7 ⚠️ Demo mode (`DEMO_LOOSE`)

For demos and UI testing, an environment flag relaxes the strategy so trades fire quickly:

- Set **`DEMO_LOOSE=1`** in the bot's environment (used only with the mock bot).
- When enabled, `check_signal()` **forces all four long conditions to `True`**, so a BUY is generated on essentially every cycle, and adds a small `+0.3` buffer to `min_rr` so rounding never trips the risk guard's R:R check.
- When the flag is **unset**, the strict strategy above applies. The live bot (`main.py`) never sets it.

> ⚠️ Trades produced under `DEMO_LOOSE` are **not** real strategy signals — the equity curve and win rate from demo runs are not meaningful. Always run without the flag to evaluate genuine strategy behaviour.

---

## 3.8 Tuning the strategy

All parameters are editable live in the dashboard's **Configuration → Strategy** tab (persisted to `strategy_configs`, hot‑reloaded by the bot):

| Parameter | Effect of increasing |
|-----------|----------------------|
| `emaFast` (21) | Slower fast‑EMA; fewer, "deeper" pullbacks |
| `emaSlow` (50) | Stronger/longer trend filter |
| `rsiPeriod` (14) | Smoother RSI |
| `rsiOversold` (40) | **Looser** dip requirement → more signals (raising toward 50–60 fires more often) |
| `atrPeriod` (14) | Smoother volatility estimate |
| `atrMultiSl` (1.5) | Wider stops (smaller lot sizes for same risk) |
| `min_rr` (2.0, in risk rules) | Demands bigger reward per trade → fewer qualifying setups |

> Note: `timeframe` is stored in `strategy_configs` but is **not** editable through the strategy API (it is fixed to H1 in Phase 1).

---

Next: [04 — Risk Management](./04-risk-management.md)
