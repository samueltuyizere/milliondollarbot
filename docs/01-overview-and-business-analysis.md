# 01 — Overview & Business Analysis

## 1.1 Purpose

AITrader automates the trading of **XAUUSD (gold)** on a **FundedNext Phase 1** prop‑firm challenge account ($500,000 simulated capital). The system exists to:

1. **Execute a disciplined, rules‑based strategy** without emotion or manual intervention.
2. **Protect the funded account** from breaching the prop firm's drawdown and daily‑loss limits — which would fail the challenge.
3. **Give the trader full visibility and control** via a web dashboard: live P&L, trade history, configuration, and an auditable log of every action.

The guiding principle is **capital preservation first**: the system is designed so that risk rules can *block* trades but human optimism can never *force* one past a breached limit.

---

## 1.2 Background & context

Prop firms such as FundedNext fund traders who pass a challenge: grow the account while respecting strict rules. The two account‑killing rules are:

- **Maximum daily loss** — lose more than X% in a single day → fail.
- **Maximum total drawdown** — equity falls X% below peak → fail.

A human trader can breach these in seconds. AITrader encodes them as hard, automated gates. The bot trades a single, well‑understood setup (an EMA pullback in an uptrend) so behaviour is predictable and auditable.

---

## 1.3 Stakeholders

| Stakeholder | Interest |
|-------------|----------|
| **Trader / Account owner** | Wants the account grown safely and the challenge passed; needs live monitoring and control. |
| **Risk owner** (often same person) | Wants hard guarantees that prop‑firm limits are never breached. |
| **Operator** | Runs the bot + dashboard, keeps them online, applies config changes. |
| **Developer / Maintainer** | Extends strategy, fixes bugs, hardens for production. |
| **Prop firm (FundedNext)** | External constraint provider — sets the rules the system must respect. |

---

## 1.4 Goals & objectives

| Goal | Success measure |
|------|------------------|
| Trade XAUUSD automatically on H1 | Bot opens/closes positions per the strategy without manual action |
| Never breach prop‑firm limits | Daily loss and drawdown gates block trades before breach; daily lock engages |
| Full transparency | Every trade, config change, and system event is recorded and viewable |
| Remote control | Start/stop/pause/resume and reconfigure from the dashboard |
| Risk‑based sizing | Each trade risks a fixed % of balance regardless of volatility |
| Safe experimentation | A paper/mock mode mirrors live behaviour with no broker risk |

---

## 1.5 Scope

### In scope (Phase 1)

- Single instrument: **XAUUSD**.
- Single strategy: **H1 EMA pullback** (long‑only).
- Single active account.
- Live execution via **MetaTrader 5** (Windows).
- Paper/mock execution via **Yahoo gold data** (any OS).
- Web dashboard: monitoring, configuration, controls, calendar (news/holidays), logs.
- Local **PostgreSQL** as the system of record.
- Credentials‑based authentication with audit logging.

### Out of scope (Phase 1) — see [Roadmap](./10-known-issues-and-roadmap.md)

- Multiple instruments / pairs.
- Short selling (the code exists but is disabled by `longOnly`).
- Cloud database sync and mobile app.
- Backtesting UI.
- Email / Telegram alerting.
- Role‑based access control enforcement (roles are currently cosmetic).

---

## 1.6 Functional requirements

| ID | Requirement | Where implemented |
|----|-------------|-------------------|
| FR‑01 | The bot shall read its configuration (strategy, risk, account, session) from a central store each cycle. | `bot/config.py` → PostgreSQL |
| FR‑02 | The bot shall obey a remote command (start/stop/pause/resume) issued from the dashboard. | `bot/config.py:get_bot_command()`, `/api/bot/control` |
| FR‑03 | The bot shall generate long signals using the H1 EMA pullback strategy. | `bot/strategy/ema_pullback.py` |
| FR‑04 | The bot shall reject any trade that fails a risk check (daily loss, drawdown, R:R, session, news, holiday, max open). | `bot/risk/risk_guard.py` |
| FR‑05 | The bot shall size each trade by risk percentage of account balance. | `utils/mt5_client.py`, `utils/lot_sizing.py` |
| FR‑06 | The bot shall send a periodic heartbeat (equity, balance, P&L, drawdown, open trades, status, mode) to the dashboard. | `utils/db_writer.py:send_heartbeat()` |
| FR‑07 | The bot shall report opened and closed trades to the dashboard. | `utils/db_writer.py`, `/api/trades*` |
| FR‑08 | The system shall hard‑lock trading for the day when the daily‑loss limit is breached, requiring manual restart. | `risk_guard.py:_activate_daily_lock()` |
| FR‑09 | The dashboard shall display live equity, daily P&L, drawdown, open trades, equity curve, and outcome breakdown. | `/dashboard` page |
| FR‑10 | The dashboard shall allow editing risk rules, strategy parameters, and bot/session settings. | `/api/config/*`, Config panel |
| FR‑11 | The dashboard shall allow manual closing of an open position. | `/api/trades/{id}/manual-close` |
| FR‑12 | The system shall maintain news‑event and bank‑holiday blackout windows that block trading. | Calendar pages, `risk_guard` checks |
| FR‑13 | The system shall record an audit trail of configuration/control changes. | `audit_logs`, `logAudit()` |
| FR‑14 | The system shall provide system, trade, and audit log views. | `/logs` page, `/api/logs/*` |
| FR‑15 | The system shall authenticate users before granting dashboard access. | Auth.js v5, `proxy.ts` |
| FR‑16 | The system shall provide a paper/simulation mode that mirrors live behaviour without a broker. | `bot/mock_bot.py` |

---

## 1.7 Non‑functional requirements

| Category | Requirement |
|----------|-------------|
| **Safety** | Risk limits must be evaluated *before* every order; a breached daily limit must not be overridable from the UI. |
| **Auditability** | All configuration/control changes recorded with action, old/new values, and (intended) user id. |
| **Resilience** | Bot tolerates transient dashboard/API failures (heartbeats and logs fail silently, short timeouts) and continues trading. |
| **Configurability** | Strategy and risk parameters are editable at runtime without restarting the bot (hot‑reloaded each loop). |
| **Observability** | Live heartbeat, structured logs (DEBUG→CRITICAL), and trade/audit history. |
| **Portability** | Mock mode runs on macOS/Linux; live mode requires Windows + MT5. |
| **Usability** | Responsive dashboard, light/dark themes, modal controls, live price ticker. |
| **Security** | Credentials hashed with bcrypt; session via JWT; bot endpoints intended to be localhost‑only in production. |

---

## 1.8 Constraints & assumptions

- **MetaTrader 5 is Windows‑only** for live trading; the `MetaTrader5` Python package does not run on macOS. Mac users use mock mode.
- **MT5 must be open and logged in** on the same machine as `main.py`; the bot does not call `mt5.login()` itself.
- **One active account** at a time (the config loader selects the single `is_active = TRUE` account).
- **Local PostgreSQL** is the source of truth; cloud sync is future work.
- **Yahoo `GC=F` (COMEX gold futures)** is used as the XAUUSD proxy for mock data; it trades at a small basis (~$10–20) to spot.
- The trading session uses a **same‑day UTC window** (string comparison); overnight windows are not supported.

---

## 1.9 Glossary

| Term | Meaning |
|------|---------|
| **XAUUSD** | Spot gold priced in US dollars. The only instrument traded. |
| **GC=F** | Yahoo Finance symbol for COMEX gold futures; used as the XAUUSD proxy in mock mode. |
| **EMA** | Exponential Moving Average. EMA 21 = fast, EMA 50 = slow. |
| **RSI** | Relative Strength Index (period 14); momentum oscillator, 0–100. |
| **ATR** | Average True Range (period 14); a volatility measure used to size stops. |
| **Pullback** | A temporary dip against the prevailing trend; the strategy buys these in uptrends. |
| **R:R** | Risk‑to‑reward ratio = reward distance ÷ risk distance. Minimum 2.0. |
| **SL / TP** | Stop Loss / Take Profit price levels. |
| **Lot** | Trade size unit. For XAUUSD, 1.0 lot = 100 oz. |
| **Drawdown** | Percentage drop in equity from its peak. |
| **Daily lock** | A hard stop that disables trading for the rest of the day after the daily‑loss limit is hit. |
| **Heartbeat** | Periodic status update the bot pushes to the dashboard. |
| **Mock / paper trading** | Simulated trading with live prices but no real broker orders. |
| **Prop firm** | A proprietary trading firm (FundedNext) that funds traders who pass its challenge. |
| **FundedNext Phase 1** | The first evaluation stage of the FundedNext challenge. |

---

Next: [02 — Architecture](./02-architecture.md)
