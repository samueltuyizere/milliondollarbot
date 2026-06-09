# 09 — Setup & Deployment

## 9.1 Prerequisites

| Requirement | For |
|-------------|-----|
| Node.js 20+ and npm | Dashboard |
| PostgreSQL 14+ | Shared database |
| Python 3.11 | Bot |
| MetaTrader 5 terminal (Windows) | **Live** trading only |
| Internet access | Mock market data (Yahoo) + dashboard price ticker |

> Live trading (`main.py`) requires **Windows + MT5**. On macOS/Linux you can run everything except live execution by using the **mock bot**.

---

## 9.2 Dashboard setup

```bash
cd dashboard
cp .env.example .env          # set DATABASE_URL and AUTH_SECRET
npm install
npx prisma migrate dev --name init   # create schema
npx prisma db seed                   # admin user + default config
npm run dev                          # http://localhost:3000  (Turbopack)
```

`.env` must contain at least:

```
DATABASE_URL="postgresql://<user>:<pass>@localhost:5432/aitrader"
AUTH_SECRET="<random-long-string>"
AUTH_URL="http://localhost:3000"
```

**Default login:** `admin@aitrader.local` / `admin1234`.

Production build:

```bash
npm run build
npm run start         # serves the compiled app
```

> ⚠️ During development, if you edit files but see no changes, make sure you don't have an **orphaned `next-server`** process serving a stale build on port 3000. Kill anything on the port and restart `npm run dev`:
> ```bash
> lsof -ti tcp:3000 | xargs kill -9
> npm run dev
> ```

---

## 9.3 Bot setup

```bash
cd bot
cp .env.example .env          # set DATABASE_URL + DASHBOARD_URL
pip install -r requirements.txt
```

`bot/.env`:

```
DATABASE_URL="postgresql://<user>:<pass>@localhost:5432/aitrader"   # same DB as dashboard
DASHBOARD_URL="http://localhost:3000"
# Optional: POLL_SECONDS, HEARTBEAT_SECONDS
```

### Run live (Windows + MT5)

```bash
python main.py
```

Requirements: MT5 open and logged in on the same machine; the active account configured in the dashboard.

### Run mock / paper (any OS)

```bash
python mock_bot.py
```

Uses live Yahoo gold prices with the real strategy and risk guard — no broker. The dashboard shows a **Simulation** badge while this mode runs.

### Quick demo (force frequent paper trades)

```bash
DEMO_LOOSE=1 python mock_bot.py
```

⚠️ This bypasses the strategy's entry conditions to fire trades quickly for UI demos — not representative of real performance. Run without the flag for genuine behaviour.

---

## 9.4 Start trading

1. Open the dashboard, log in.
2. Open **Bot Control** (header status pill or sidebar) and click **Start** → sets `bot_status.status = RUNNING`.
3. The running bot picks up `RUNNING` on its next loop and begins evaluating signals.
4. Watch the dashboard: KPIs, equity curve, recent trades, and live floating P&L update from the bot's heartbeats.

Stop/Pause/Resume from the same panel. If the daily‑loss lock engages, only **Start** (a deliberate restart) is accepted.

---

## 9.5 Operational runbook

| Situation | What to do |
|-----------|-----------|
| Bot shows STOPPED but should run | Click **Start** in Bot Control |
| Daily lock engaged | Review the day's P&L; restart only when intentional. ⚠️ Also clear `risk_rules.daily_lock_active` (currently not auto‑cleared) |
| No trades appearing (live strategy) | Normal — the setup is selective; confirm session window (08:00–17:00 UTC), no news/holiday blackout, and RUNNING status |
| Mock bot died after shell exit | Re‑launch under a process manager / persistent terminal; verify the PID stays alive |
| Yahoo data warnings in logs | Usually transient rate‑limit/network; the bot falls back to cached data and retries |
| Price ticker off vs TradingView | Ticker shows **spot**; bot trades **futures** (`GC=F`) — a ~$10–20 basis is expected |
| Dashboard edits not reflecting | Kill stale `next-server` on :3000, restart `npm run dev` |

### Useful checks

```bash
# Is something serving on 3000?
lsof -ti tcp:3000

# Current bot status in DB
psql "$DATABASE_URL" -tc "SELECT status, bot_mode, last_ping FROM bot_status ORDER BY updated_at DESC LIMIT 1;"

# Recent trades
psql "$DATABASE_URL" -c "SELECT symbol,direction,entry_price,status,open_time FROM trades ORDER BY open_time DESC LIMIT 5;"
```

---

## 9.6 Production hardening checklist

Before exposing this beyond a single localhost machine, address the items in [10 — Known Issues](./10-known-issues-and-roadmap.md), especially:

- [ ] Restrict the **public bot API routes** (`/api/bot/heartbeat`, `/api/trades*`, `/api/logs/system`) to localhost / a shared secret.
- [ ] Fix the `main.py` **STOPPED‑path** bug before running live unattended.
- [ ] Clear `daily_lock_active` on a deliberate restart.
- [ ] Populate `audit_logs.userId` from the session.
- [ ] Sync `accounts.balance` from the live MT5 account.
- [ ] Add automated tests around the strategy and risk guard.
- [ ] Set a strong `AUTH_SECRET` and rotate the seeded password.

---

Next: [10 — Known Issues & Roadmap](./10-known-issues-and-roadmap.md)
