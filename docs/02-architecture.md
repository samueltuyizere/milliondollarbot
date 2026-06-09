# 02 — Architecture

## 2.1 High‑level overview

AITrader is a **two‑process system** sharing one **PostgreSQL** database:

1. **Dashboard** — a Next.js 16 web app (UI + API routes) for humans.
2. **Bot** — a Python process that trades (live on MT5, or paper via Yahoo).

They communicate through **two channels**:

- **PostgreSQL (dashboard → bot):** the dashboard writes configuration and the run command; the bot reads them directly via `psycopg2`.
- **HTTP (bot → dashboard):** the bot pushes heartbeats, trade open/close events, and system logs to the dashboard's public API routes.

```
                         ┌───────────────────────────────────────────────┐
                         │                  PostgreSQL                     │
                         │  users, accounts, bot_configs, strategy_configs,│
                         │  risk_rules, bot_status, trades, trade_logs,    │
                         │  system_logs, news_events, bank_holidays,       │
                         │  audit_logs                                     │
                         └───────▲───────────────────────────────▲─────────┘
                 Prisma (RW)     │                               │  psycopg2 (read)
                                 │                               │
              ┌──────────────────┴───────────┐      ┌────────────┴──────────────────┐
              │      Next.js Dashboard        │      │       Python Trading Bot       │
              │                               │      │                                │
              │  Pages (App Router, RSC+CSR)  │      │  main.py (live)  mock_bot.py   │
              │  API routes (/api/*)          │      │   ├─ config.py   (read config) │
              │  Auth.js v5 + proxy.ts        │      │   ├─ strategy/ema_pullback.py  │
              │  Prisma client                │      │   ├─ risk/risk_guard.py        │
              │                               │      │   ├─ utils/mt5_client.py (live)│
              │                               │      │   ├─ utils/market_data.py(mock)│
              │                               │      │   ├─ utils/lot_sizing.py (mock)│
              │                               │      │   ├─ utils/db_writer.py (HTTP) │
              │                               │      │   └─ utils/logger.py (HTTP)    │
              └───────▲───────────────────────┘      └───────┬────────────────────────┘
                      │  HTTP (heartbeat, trades, logs)      │
                      └──────────────────────────────────────┘
                                                              │
                                          ┌───────────────────┴────────────────┐
                                          │  MetaTrader 5 terminal (live)        │
                                          │  Yahoo Finance GC=F + gold-api(mock) │
                                          └──────────────────────────────────────┘
```

---

## 2.2 Components

### Dashboard (`/dashboard`)

- **Framework:** Next.js 16.2.7 (App Router, Turbopack), React 19.2.
- **Auth:** Auth.js v5 (`next-auth` beta) — credentials provider, JWT sessions. Route protection lives in **`src/proxy.ts`** (Next.js 16's replacement for `middleware.ts`).
- **ORM:** Prisma 5 → PostgreSQL.
- **UI:** Tailwind CSS v4, shadcn/Base UI components, Recharts, `next-themes` (light/dark), `lucide-react`, `sonner` toasts.
- **Responsibilities:** authenticate users, render monitoring views, expose API routes for both humans (protected) and the bot (public), persist all config/trades/logs, enforce audit logging.

See [06 — Dashboard](./06-dashboard.md).

### Bot (`/bot`)

- **Runtime:** Python 3.11.
- **Two entry points sharing strategy + risk code:**
  - `main.py` — **live**, MetaTrader 5 execution (Windows).
  - `mock_bot.py` — **paper**, Yahoo `GC=F` data, in‑memory positions (any OS).
- **Responsibilities:** read config/command, compute signals, enforce risk, size and place orders, manage exits, report state.

See [05 — Bot Internals](./05-bot-internals.md).

### Database (PostgreSQL)

The single source of truth for both processes. Schema is owned by Prisma (dashboard) and read directly by the bot. See [07 — Data Model](./07-data-model.md).

### External data / execution

| Mode | Market data | Execution |
|------|-------------|-----------|
| Live (`main.py`) | MT5 `copy_rates_from_pos` | MT5 market orders |
| Mock (`mock_bot.py`) | Yahoo `GC=F` chart API (OHLCV + price) | In‑memory paper positions |
| Dashboard ticker | `api.gold-api.com` (spot) + Yahoo `GC=F` (% change) | — |

---

## 2.3 Communication contract

### Channel A — PostgreSQL (Dashboard → Bot)

The bot **reads** these every loop iteration:

| Data | Table(s) | Bot accessor |
|------|----------|--------------|
| Run command | `bot_status.status` (latest row) | `get_bot_command()` |
| Account + limits | `accounts` (active) | `load_bot_config()` |
| Bot/session settings | `bot_configs` | `load_bot_config()` |
| Strategy parameters | `strategy_configs` | `load_bot_config()` |
| Risk rules | `risk_rules` | `load_bot_config()` |
| News blackouts | `news_events` | `load_news_events()` |
| Bank holidays | `bank_holidays` | `load_bank_holidays()` |
| Manual close request | `trades.manual_close` | (mock) polls `/api/trades?status=OPEN` |

> Configuration is **hot‑reloaded**: editing risk/strategy in the dashboard takes effect on the bot's next cycle (within `POLL_SECONDS`), no restart needed.

### Channel B — HTTP (Bot → Dashboard)

The bot **pushes** to these **public** (unauthenticated) routes:

| Method | Endpoint | Sender | Payload |
|--------|----------|--------|---------|
| POST | `/api/bot/heartbeat` | `send_heartbeat()` | status, equity, balance, dailyPnl, peakEquity, drawdownPct, openTrades, errorMsg, botMode |
| POST | `/api/trades` | `report_trade_opened()` | accountId, symbol, direction, entryPrice, stopLoss, takeProfit, lotSize, mt5Ticket |
| POST | `/api/trades/{id}/close` | `report_trade_closed()` | closePrice, pnl, commission, swap |
| GET | `/api/trades?limit=N` | session restore / ticket seq | — |
| GET | `/api/trades?status=OPEN` | (mock) manual‑close poll | — |
| POST | `/api/logs/system` | `log()` | level, source, message, metadata |

These routes are deliberately public so the bot needs no session. In production they should be restricted to localhost (see [Known Issues](./10-known-issues-and-roadmap.md)).

---

## 2.4 Runtime data flow — a trade's life

```
1. Operator clicks "Start" in dashboard
      → POST /api/bot/control { command: "start" }
      → bot_status.status = RUNNING   (+ audit log)

2. Bot loop (every POLL_SECONDS ≈ 15s):
      → load_bot_config()             (reads PostgreSQL)
      → get_bot_command()  == RUNNING
      → fetch OHLCV (MT5 or Yahoo)
      → check_signal(df, cfg)         (EMA pullback)
            └─ no signal → sleep, repeat
      → RiskGuard.check_all(...)
            └─ blocked → log reason, sleep, repeat
      → calculate_lot_size(...)
      → place_order(...) / _open_paper_trade(...)
      → POST /api/trades  → trades row (OPEN) + trade_logs "OPENED"

3. Heartbeat (every HEARTBEAT_SECONDS ≈ 10s):
      → POST /api/bot/heartbeat → bot_status updated
      → dashboard polls /api/bot/status every few seconds → UI updates

4. Exit:
   Live: MT5 hits SL/TP → _check_closed_positions() detects → POST /api/trades/{id}/close
   Mock: _check_paper_exits() compares live price to SL/TP → POST .../close
   Manual: user → POST /api/trades/{id}/manual-close → trades.manual_close = true
           → (mock) bot polls, closes at market → .../close

5. If daily loss limit breached during a check:
      → _activate_daily_lock(): bot_status.status = DAILY_LOCK,
        risk_rules.daily_lock_active = true  (+ CRITICAL log)
      → trading disabled until manual restart
```

---

## 2.5 Deployment topology

### Production (intended)

```
┌──────────────────────── Windows machine ─────────────────────────┐
│  MetaTrader 5 (open, logged in)                                   │
│  Python bot:  python main.py                                      │
│  PostgreSQL (local, primary)                                      │
│  Next.js dashboard:  npm run start  (http://localhost:3000)       │
│                                                                   │
│  Bot ↔ dashboard ↔ DB all on localhost                            │
└───────────────────────────────────────────────────────────────────┘
                         (Phase 2: cloud DB replica + mobile app)
```

Everything runs on one Windows host so MT5, the bot, the dashboard, and the database all reach each other over `localhost`. This is why the bot API routes are unauthenticated — they are not meant to be network‑exposed.

### Development / paper trading (macOS/Linux)

```
┌──────────────────────── Mac / Linux ─────────────────────────────┐
│  PostgreSQL (local)                                               │
│  Next.js dashboard:  npm run dev   (http://localhost:3000)        │
│  Python mock bot:    python mock_bot.py   (Yahoo data, no broker) │
└───────────────────────────────────────────────────────────────────┘
```

This is the configuration used during development and for demos. It exercises the entire pipeline (signal → risk → sizing → trade → dashboard) with **live prices** but **no broker risk**.

---

## 2.6 Design decisions & rationale

| Decision | Rationale |
|----------|-----------|
| **Shared DB for config (not an API)** | The bot needs config every loop; reading PostgreSQL directly is simple, fast, and avoids auth complexity on a localhost deployment. |
| **HTTP for bot → dashboard** | Trade/heartbeat/log writes go through the dashboard so business logic (status classification, audit, trade‑log events) lives in one place. |
| **Two entry points, shared core** | `strategy/` and `risk/` are identical between live and mock; only data source and execution differ. This keeps paper trading faithful to live behaviour. |
| **Risk guard re‑instantiated each loop** | Picks up config changes immediately and re‑reads peak equity / today's P&L from the DB each time. |
| **Public bot endpoints** | Removes the need for the bot to manage a session on a localhost‑only deployment. Trade‑off: must be firewalled in production. |
| **Singleton config pattern** | Phase 1 supports one account; APIs use `findFirst()`/active‑account selection rather than multi‑tenant lookups. |
| **JWT sessions + bcrypt** | Stateless auth without a session store; password hashing standard. |

---

Next: [03 — Trading Strategy](./03-trading-strategy.md)
