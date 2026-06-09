# 04 — Risk Management

> **Source:** `bot/risk/risk_guard.py` (gate), `bot/utils/mt5_client.py` + `bot/utils/lot_sizing.py` (sizing). Thresholds come from `risk_rules`, `accounts`, and `bot_configs`.

Risk management is the heart of AITrader. The strategy may *suggest* a trade, but the **RiskGuard** decides whether it is allowed. The design rule: **risk can always block a trade; nothing can force one past a breached limit.**

---

## 4.1 The RiskGuard gate

`RiskGuard` is **re‑instantiated every loop** with the freshly loaded config, then `check_all(...)` is called before any order. It is **fast‑fail**: the first failing check blocks the trade and returns a human‑readable reason (which is logged).

```python
allowed, reason = guard.check_all(
    entry, sl, tp, direction,
    open_trades_count,
    equity,
)
if not allowed:
    log("WARNING", "risk", f"Signal rejected: {reason}")
    # ...skip this cycle
```

### Checks, in order

| # | Check | Blocks when | Default threshold | Source |
|---|-------|-------------|-------------------|--------|
| 1 | **Daily lock** | `daily_lock_active == True` | — | `risk_rules.daily_lock_active` |
| 2 | **Daily loss** | today's realized P&L `≤ −(balance × maxDailyLossPct%)` | 1.0% of balance | `risk_rules.max_daily_loss_pct` |
| 3 | **Drawdown** | `(peak − equity)/peak × 100 ≥ maxDrawdownPct` | 4.5% | `risk_rules.max_drawdown_pct` |
| 4 | **Max open trades** | `open_trades_count ≥ maxOpenTrades` | 1 | `risk_rules.max_open_trades` |
| 5 | **Risk:reward** | `risk ≤ 0` or `reward/risk < minRR` | 2.0 | `risk_rules.min_rr` |
| 6 | **Session window** | now (UTC) outside `[sessionStart, sessionEnd]` | 08:00–17:00 | `bot_configs.session_*` |
| 7 | **News blackout** | within a news event's `[−minutesBefore, +minutesAfter]` window | ±30 min | `news_events` |
| 8 | **Bank holiday** | any holiday dated today | — | `bank_holidays` |

If every check passes, `check_all` returns `(True, "OK")` and the bot proceeds to sizing and execution.

---

## 4.2 Each check in detail

### 1. Daily lock
Reads `daily_lock_active` from the config. If a previous loss breach engaged the lock, **all** trading is blocked until a manual restart clears it. Reason: `"Daily loss lock is active"`.

### 2. Daily loss → hard lock
- `max_loss_usd = balance × (maxDailyLossPct / 100)` (default 1% → $5,000 on $500k).
- Today's P&L is the **sum of realized P&L** of trades closed today (`_get_today_pnl()` reads `trades` where `DATE(close_time) = CURRENT_DATE` and status in `CLOSED_WIN/LOSS/BE`).
- If `today_pnl ≤ −max_loss_usd`, the trade is blocked **and** `_activate_daily_lock()` fires (see §4.3).

> ⚠️ This check uses **realized** P&L only. Open‑position floating losses are not included here, so a large unrealized loss won't trigger the lock until positions close. See [Known Issues](./10-known-issues-and-roadmap.md).

### 3. Drawdown
- `peak_equity` is read from the latest `bot_status` row (i.e. the last heartbeat), not from in‑process state.
- `dd_pct = (peak_equity − equity) / peak_equity × 100`.
- Blocks if `dd_pct ≥ maxDrawdownPct` (default 4.5%, deliberately below FundedNext's 5% hard limit).

> ⚠️ Because peak comes from the last heartbeat, it can lag the true peak slightly.

### 4. Max open trades
Blocks if the current open count is at or above `maxOpenTrades` (default 1 → one position at a time in Phase 1).

### 5. Risk:reward
- **BUY:** `risk = entry − sl`, `reward = tp − entry`.
- **SELL:** `risk = sl − entry`, `reward = entry − tp`.
- Blocks if `risk ≤ 0` or `reward / risk < min_rr` (default 2.0).

### 6. Session window
- `now_utc` formatted as `"%H:%M"` is compared (string comparison) against `session_start`–`session_end` (default `"08:00"`–`"17:00"`).
- ⚠️ String comparison only works for **same‑day** windows; an overnight window like `22:00`–`06:00` would not behave correctly.

### 7. News blackout
- For each event from `load_news_events()` (those with `skip_trading = TRUE` in a −12h/+24h window):
  - `delta_min = (now − event_time)` in minutes.
  - Blocks if `−minutes_before ≤ delta_min ≤ minutes_after` (defaults ±30 min).
- Purpose: avoid trading through high‑impact releases (NFP, FOMC, CPI…) where gold gaps violently.

### 8. Bank holiday
- Blocks if `load_bank_holidays()` returns any row dated `CURRENT_DATE`.

---

## 4.3 The daily‑lock mechanism

When the daily‑loss check trips, `_activate_daily_lock()` performs two DB writes and a log:

1. `UPDATE bot_status SET status = 'DAILY_LOCK'` (latest row).
2. `UPDATE risk_rules SET daily_lock_active = TRUE` for the active account's bot config.
3. Emits a `CRITICAL` system log.

Effects:
- The bot's `get_bot_command()` returns `DAILY_LOCK`; the main loop enters the locked branch (heartbeat only, long sleep).
- The dashboard shows a red "Daily loss limit reached — bot is locked" banner.
- The **dashboard cannot clear the lock** — `/api/bot/control` rejects any command except `start` while in `DAILY_LOCK`. Only a deliberate restart (which sets `RUNNING`) resumes trading.

> ⚠️ Known gap: restarting via the control API sets `bot_status` to `RUNNING` but does **not** clear `risk_rules.daily_lock_active`, so the guard may immediately re‑lock. Clearing that flag is tracked in [Known Issues](./10-known-issues-and-roadmap.md).

---

## 4.4 Lot sizing

Sizing makes **dollar risk constant** regardless of volatility: a wider (ATR‑driven) stop produces a smaller lot, and vice‑versa.

### Live (`utils/mt5_client.py:calculate_lot_size`)

```
sl_distance  = |entry − sl|
risk_amount  = balance × (risk_pct / 100)
sl_in_ticks  = sl_distance / tick_size
lot_size     = risk_amount / (sl_in_ticks × tick_value)
→ clamp to [volume_min, volume_max], round to volume_step
→ fallback 0.01 on any error
```

Uses the live symbol's tick size/value from MT5.

### Mock (`utils/lot_sizing.py:calculate_lot_size`)

Mirrors the above using fixed XAUUSD specs so paper sizing matches live:

```python
SYMBOL_SPECS["XAUUSD"] = {
    "contract_size": 100.0,   # oz per 1.0 lot
    "volume_min": 0.01,
    "volume_max": 50.0,
    "volume_step": 0.01,
}

risk_amount = balance × (risk_pct / 100)
lot_size    = risk_amount / (sl_distance × contract_size)
→ clamp + round as above
```

### Worked example

With `balance = 500,000`, `risk_pct = 0.25%`, `sl_distance = 23.25` (from the [strategy example](./03-trading-strategy.md#35-worked-example)):

```
risk_amount = 500,000 × 0.0025 = $1,250
lot_size    = 1,250 / (23.25 × 100) = 1,250 / 2,325 = 0.5376 → 0.54 lots
```

So the trade risks ~$1,250 (0.25%) whether ATR is large or small.

### P&L (mock, `calc_pnl`)

```
diff = close_price − entry      (negated for SELL)
pnl  = diff × lot_size × contract_size   (rounded to 2 dp)
```

The dashboard uses this same formula client‑side to show **live floating P&L** on open trades, valued against the **futures** reference price the bot trades on (not spot) so there is no basis distortion.

---

## 4.5 Risk parameters reference

| Parameter | Default | Meaning | Table |
|-----------|---------|---------|-------|
| `riskPerTradePct` | 0.25% | % of balance risked per trade (~$1,250 on $500k) | `risk_rules` |
| `maxDailyLossPct` | 1.0% | Daily realized loss that triggers the hard lock | `risk_rules` |
| `maxDrawdownPct` | 4.5% | Equity drop from peak that blocks trading (FundedNext limit is 5%) | `risk_rules` |
| `minRR` | 2.0 | Minimum reward:risk to accept a signal | `risk_rules` |
| `maxOpenTrades` | 1 | Concurrent positions allowed | `risk_rules` |
| `dailyLockActive` | false | Whether the daily lock is currently engaged | `risk_rules` |
| `drawdownLimit` | 5.0% | Account‑level reference limit | `accounts` |
| `dailyLossLimit` | 1.0% | Account‑level reference limit | `accounts` |
| `sessionStart` / `sessionEnd` | 08:00 / 17:00 | UTC trading window | `bot_configs` |
| `longOnly` | true | Disable short trades | `bot_configs` |
| `minutesBefore` / `minutesAfter` | 30 / 30 | News blackout padding | `news_events` |

These are editable in **Configuration → Risk** and **Configuration → Bot** in the dashboard.

---

Next: [05 — Bot Internals](./05-bot-internals.md)
