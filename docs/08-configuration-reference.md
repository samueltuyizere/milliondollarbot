# 08 — Configuration Reference

This is the authoritative list of every tunable parameter and environment variable, with defaults and where each lives.

## 8.1 Strategy parameters (`strategy_configs`)

Editable in **Configuration → Strategy** (`PUT /api/config/strategy`), hot‑reloaded by the bot each loop.

| Parameter | Column | Default | Meaning |
|-----------|--------|---------|---------|
| `emaFast` | `ema_fast` | 21 | Fast EMA span |
| `emaSlow` | `ema_slow` | 50 | Slow EMA span (trend filter) |
| `rsiPeriod` | `rsi_period` | 14 | RSI lookback |
| `rsiOversold` | `rsi_oversold` | 40.0 | RSI dip threshold for long entry (higher = looser = more signals) |
| `atrPeriod` | `atr_period` | 14 | ATR lookback |
| `atrMultiSl` | `atr_multi_sl` | 1.5 | Stop distance = ATR × this |
| `timeframe` | `timeframe` | "H1" | Candle timeframe (⚠️ not editable via API in Phase 1) |

## 8.2 Risk rules (`risk_rules`)

Editable in **Configuration → Risk** (`PUT /api/config/risk`).

| Parameter | Column | Default | Meaning |
|-----------|--------|---------|---------|
| `riskPerTradePct` | `risk_per_trade_pct` | 0.25 | % of balance risked per trade (~$1,250 on $500k) |
| `maxDailyLossPct` | `max_daily_loss_pct` | 1.0 | Daily realized loss that triggers the hard lock |
| `maxDrawdownPct` | `max_drawdown_pct` | 4.5 | Drawdown from peak that blocks trading (FundedNext limit 5%) |
| `minRR` | `min_rr` | 2.0 | Minimum reward:risk to accept a signal |
| `maxOpenTrades` | `max_open_trades` | 1 | Concurrent positions allowed |
| `dailyLockActive` | `daily_lock_active` | false | Whether the daily lock is engaged (set by risk guard) |

## 8.3 Bot / session settings (`bot_configs`)

Editable in **Configuration → Bot** (`PUT /api/config/bot`), except where noted.

| Parameter | Column | Default | Meaning |
|-----------|--------|---------|---------|
| `symbol` | `symbol` | "XAUUSD" | Instrument (fixed in Phase 1) |
| `longOnly` | `long_only` | true | Disable short trades |
| `sessionStart` | `session_start` | "08:00" | UTC session open (HH:MM) |
| `sessionEnd` | `session_end` | "17:00" | UTC session close (HH:MM) |
| `isRunning` | `is_running` | false | ⚠️ loaded but unused — can drift |
| `isPaused` | `is_paused` | false | ⚠️ loaded but unused — can drift |

## 8.4 Account settings (`accounts`)

| Parameter | Column | Default | Meaning |
|-----------|--------|---------|---------|
| `balance` | `balance` | 500000 | Account balance used for sizing/limits ⚠️ static, not synced from MT5 |
| `currency` | `currency` | "USD" | |
| `broker` | `broker` | "FundedNext" | |
| `drawdownLimit` | `drawdown_limit` | 5.0 | Reference account drawdown limit |
| `dailyLossLimit` | `daily_loss_limit` | 1.0 | Reference account daily‑loss limit |
| `isActive` | `is_active` | true | The bot trades the single active account |
| `phase` | `phase` | "Phase 1" | |

## 8.5 News blackout (`news_events`)

Managed in **Calendar → News Events**.

| Parameter | Default | Meaning |
|-----------|---------|---------|
| `impact` | HIGH | LOW / MEDIUM / HIGH |
| `skipTrading` | true | Whether this event blocks trading |
| `minutesBefore` | 30 | Blackout starts this many minutes before the event |
| `minutesAfter` | 30 | Blackout ends this many minutes after the event |

## 8.6 Environment variables

### Bot (`bot/.env`)

| Variable | Required | Default | Used by |
|----------|----------|---------|---------|
| `DATABASE_URL` | **Yes** | — | `config.py` (PostgreSQL) |
| `DASHBOARD_URL` | No | `http://localhost:3000` | `db_writer.py`, `logger.py` |
| `DASHBOARD_API_URL` | No | `http://localhost:3000` | `mock_bot.py` ticket‑seq init |
| `POLL_SECONDS` | No | 15 | loop cadence |
| `HEARTBEAT_SECONDS` | No | 10 | heartbeat cadence |
| `DEMO_LOOSE` | No | unset | set `1` to relax strategy for demos (mock only) |
| `MT5_LOGIN` / `MT5_PASSWORD` / `MT5_SERVER` | No | — | ⚠️ present in `.env.example` but unused |

### Dashboard (`dashboard/.env`)

| Variable | Required | Meaning |
|----------|----------|---------|
| `DATABASE_URL` | **Yes** | PostgreSQL connection (same DB the bot reads) |
| `AUTH_SECRET` | **Yes** | Auth.js JWT signing secret |
| `NEXTAUTH_URL` / `AUTH_URL` | Recommended | Base URL for Auth.js (e.g. `http://localhost:3000`) |

## 8.7 Timing & cadence summary

| Thing | Interval | Where |
|-------|----------|-------|
| Bot trading loop | `POLL_SECONDS` (15 s) | bot |
| Bot heartbeat | `HEARTBEAT_SECONDS` (10 s) | bot |
| Dashboard status/trades poll | 5 s | `/dashboard` |
| Dashboard price poll | 4 s | `/dashboard` |
| Header price ticker | 15 s | `PriceTicker` |
| Bot control panel status poll | 3 s (while open) | `BotControlPanel` |
| Market price server cache | 15 s | `/api/market/price` |
| Yahoo OHLCV cache (bot) | 45 s | `market_data.py` |

## 8.8 How a config change propagates

```
User edits value in Configuration modal
   → PUT /api/config/{risk|strategy|bot}    (writes DB + audit_logs)
   → bot's next loop calls load_bot_config() (reads DB)
   → new value in effect within POLL_SECONDS (~15s)  — no bot restart
```

---

Next: [09 — Setup & Deployment](./09-setup-and-deployment.md)
