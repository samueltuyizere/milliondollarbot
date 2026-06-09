# AITrader — XAUUSD Bot Control System

Control dashboard + Python MT5 trading bot for **FundedNext Phase 1** ($200k funded account).

## Architecture

```
dashboard/          Next.js 16 web app (UI + API routes)
bot/                Python trading bot (MT5 + risk guard)
```

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, TypeScript, Tailwind CSS, shadcn/ui (base-nova) |
| Backend | Next.js API Routes (App Router) |
| Auth | Auth.js v5 (credentials + JWT, RBAC) |
| ORM | Prisma 5 |
| Primary DB | PostgreSQL (local) |
| Bot | Python 3.11 + MetaTrader5 + psycopg2 |
| Broker | FundedNext via MT5 |

## Quick Start

### 1. Dashboard

```bash
cd dashboard
cp .env.example .env          # fill in DATABASE_URL and AUTH_SECRET
npm install
npx prisma migrate deploy     # applies all migrations
npx prisma db seed            # creates admin user + default config + RBAC roles/permissions
npm run dev                   # http://localhost:3000
```

Login: `admin@aitrader.local` / `admin1234`

### 2. Python Bot (paper trading — any machine)

```bash
cd bot
cp .env.example .env          # fill in DATABASE_URL + DASHBOARD_URL
pip install -r requirements.txt
python mock_bot.py            # paper trading with live XAUUSD prices
```

### 3. Start everything at once (macOS/Linux)

```bash
./start.sh           # starts dashboard + mock bot
./start.sh --live    # starts dashboard + live MT5 bot (Windows only)
```

`Ctrl+C` stops both. The bot auto-restarts on crashes.

> For live MT5 trading: MT5 must be open and logged in on the same Windows machine.

## Pages

| Route | Purpose |
|-------|---------|
| `/dashboard` | Live equity, P&L, drawdown cards, recent trades, charts |
| `/trades` | Full trade history with filters, pagination, trade detail modal |
| `/calendar` | News events + bank holidays (blackout management) |
| `/logs` | System, trade, and audit logs |
| `/settings/users` | User management (ADMIN only) |
| `/settings/roles` | Role & permission management (ADMIN only) |

## Bot Execution Flow

```
Python Bot
   ↓ Read active config from local DB
   ↓ Restore session state (today P&L, peak equity)
   ↓ Clean up orphaned open trades from prior session
   ↓ Check command from dashboard (start/stop/pause)
   ↓ Check manual-close requests from dashboard
   ↓ Send heartbeat to dashboard
   ↓ Check session window (UTC 08:00–17:00)
   ↓ Check news/bank holiday blackout      ← STOP if blocked
   ↓ Check daily P&L (realized + floating) ← HARD LOCK if breached
   ↓ Check drawdown vs max_drawdown        ← STOP if breached
   ↓ Check max open trades                 ← SKIP if at limit
   ↓ Run H1 EMA pullback strategy signal
   ↓ Validate R:R ratio                    ← REJECT if < min_rr
   ↓ Calculate lot size (risk % of balance)
   ↓ Place MT5 order / paper order
   ↓ Log trade + update dashboard
```

## Risk Rules (defaults)

| Rule | Default | Notes |
|------|---------|-------|
| Risk per trade | 0.25% | $500 on $200k |
| Max daily loss | 1.0% | Hard lock (cannot trade until restart) |
| Max drawdown | 4.5% | Soft stop (below FundedNext 5% limit) |
| Min R:R | 2.0 | Trade rejected if TP/SL < 2 |
| Max open trades | 1 | Phase 1: one position at a time |
| Long only | ✓ | Safer for prop account rules |

## RBAC (Roles & Permissions)

| Role | Permissions |
|------|-------------|
| **ADMIN** | All — full access including users, roles, config, risk edit |
| **TRADER** | Dashboard, trades (view + close), bot view, config view, risk view |

Custom roles can be created from `/settings/roles`. Each role gets a granular permission set across 7 categories: dashboard, trades, bot, config, risk, users, roles.

Permissions are embedded in the JWT on login — no per-request DB lookups.

## API Routes

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/bot/status` | 🔒 | Current bot state |
| POST | `/api/bot/control` | 🔒 | `{command: start\|stop\|pause\|resume}` |
| POST | `/api/bot/heartbeat` | 🔓 | Python bot heartbeat |
| GET/PUT | `/api/config/risk` | 🔒 | Risk rules |
| GET/PUT | `/api/config/strategy` | 🔒 | Strategy params |
| GET/PUT | `/api/config/bot` | 🔒 | Bot settings |
| GET/POST | `/api/trades` | 🔓 | Trade history / create |
| POST | `/api/trades/{id}/manual-close` | 🔒 | Flag trade for closure |
| GET | `/api/market/price` | 🔒 | Live XAUUSD spot + futures price |
| GET/POST | `/api/calendar/news` | 🔒 | News events |
| GET/POST | `/api/calendar/holidays` | 🔒 | Bank holidays |
| GET | `/api/logs/system` | 🔓 | System logs |
| GET | `/api/logs/trades` | 🔒 | Trade logs |
| GET | `/api/logs/audit` | 🔒 | Audit logs |
| GET | `/api/permissions` | 🔒 | All permission codes |
| GET/POST | `/api/roles` | 🔒 | Role list / create |
| GET/PUT/DELETE | `/api/roles/{id}` | 🔒 | Role detail / update / delete |
| GET/POST | `/api/users` | 🔒 | User list / create |
| GET/PUT/DELETE | `/api/users/{id}` | 🔒 | User detail / update / delete |

## Security Notes

- All config changes are written to `audit_logs`
- The daily loss lock **cannot be overridden from the UI** — only a manual restart clears it
- Bot API endpoints (`/api/bot/heartbeat`, `/api/trades`, `/api/logs/system`) bypass auth for local bot access
- RBAC enforced on all `/settings/*` and user/role API routes
- Default credentials (`admin1234`) should be rotated before any shared/production use

## Phase 1 Constraints

- **Symbol**: XAUUSD only
- **Strategy**: H1 EMA pullback (EMA 21/50 + RSI + ATR)
- **Account**: $200k FundedNext Phase 1 — one active account
- **Direction**: Long only (short side available post-challenge)

## Future (Phase 2+)

- Mobile app (React Native + cloud DB)
- Multi-pair support
- Backtesting UI
- Email/Telegram alerts
- Balance sync from live MT5 account
