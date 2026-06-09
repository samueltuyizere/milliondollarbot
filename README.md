# AITrader — XAUUSD Bot Control System

Control dashboard + Python MT5 trading bot for **FundedNext Phase 1** ($500k funded account).

## Architecture

```
dashboard/          Next.js 15 web app (UI + API routes)
bot/                Python trading bot (MT5 + risk guard)
```

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Next.js API Routes (App Router) |
| Auth | NextAuth.js v5 (credentials) |
| ORM | Prisma 5 |
| Primary DB | PostgreSQL (local, Windows) |
| Remote DB | Neon / Supabase (cloud backup + future mobile) |
| Bot | Python 3.11 + MetaTrader5 + psycopg2 |
| Broker | FundedNext via MT5 |

## Quick Start

### 1. Dashboard

```bash
cd dashboard
cp .env.example .env          # fill in DATABASE_URL and AUTH_SECRET
npm install
npx prisma migrate dev --name init
npx prisma db seed            # creates admin user + default config
npm run dev                   # http://localhost:3000
```

Login: `admin@aitrader.local` / `admin1234`

### 2. Python Bot (Windows laptop with MT5 installed)

```bash
cd bot
cp .env.example .env          # fill in DATABASE_URL + DASHBOARD_URL
pip install -r requirements.txt
python main.py
```

> MT5 must be open and logged in on the same machine.

## Pages

| Route | Purpose |
|-------|---------|
| `/dashboard` | Live equity, P&L, drawdown, recent trades |
| `/bot` | Start / Stop / Pause bot controls |
| `/config` | Risk rules, strategy params, session settings |
| `/calendar` | News events + bank holidays |
| `/logs` | System, trade, and audit logs |

## Bot Execution Flow

```
Python Bot
   ↓ Read active config from local DB
   ↓ Check command from dashboard (start/stop/pause)
   ↓ Send heartbeat to dashboard
   ↓ Check session window (UTC)
   ↓ Check news/bank holiday blackout      ← STOP if blocked
   ↓ Check daily P&L vs max_daily_loss     ← HARD LOCK if breached
   ↓ Check drawdown vs max_drawdown        ← STOP if breached
   ↓ Check max open trades                 ← SKIP if at limit
   ↓ Run H1 EMA pullback strategy signal
   ↓ Validate R:R ratio                    ← REJECT if < min_rr
   ↓ Calculate lot size (risk % of balance)
   ↓ Place MT5 order
   ↓ Log trade + update dashboard
```

## Risk Rules (defaults)

| Rule | Default | Notes |
|------|---------|-------|
| Risk per trade | 0.25% | $1,250 on $500k |
| Max daily loss | 1.0% | Hard lock (cannot trade until restart) |
| Max drawdown | 4.5% | Soft stop (below FundedNext 5% limit) |
| Min R:R | 2.0 | Trade rejected if TP/SL < 2 |
| Max open trades | 1 | Phase 1: one position at a time |
| Long only | ✓ | Safer for prop account rules |

## Phase 1 Constraints

- **Symbol**: XAUUSD only
- **Strategy**: H1 EMA pullback (EMA 21/50 + RSI + ATR)
- **Account**: One active account
- **Database**: Local PostgreSQL (primary), cloud (backup)

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/bot/status` | Current bot state |
| POST | `/api/bot/control` | `{command: start\|stop\|pause\|resume}` |
| POST | `/api/bot/heartbeat` | Python bot heartbeat (no auth) |
| GET/PUT | `/api/config/risk` | Risk rules |
| GET/PUT | `/api/config/strategy` | Strategy params |
| GET/PUT | `/api/config/bot` | Bot settings |
| GET/POST | `/api/trades` | Trade history |
| POST | `/api/trades/{id}/close` | Close a trade record |
| GET/POST | `/api/calendar/news` | News events |
| GET/POST | `/api/calendar/holidays` | Bank holidays |
| GET | `/api/logs/system` | System logs |
| GET | `/api/logs/trades` | Trade logs |
| GET | `/api/logs/audit` | Audit logs |

## Security Notes

- All config changes are written to `audit_logs`
- The daily loss lock **cannot be overridden from the UI** — only a manual restart clears it
- Bot API endpoints (`/api/bot/heartbeat`, `/api/trades`, `/api/logs/system`) bypass auth for local bot access
- In production, add firewall rules so only `localhost` can reach these endpoints

## Future (Phase 2)

- Mobile app (React Native + Neon cloud DB)
- Multi-pair support
- Backtesting UI
- Email/Telegram alerts
