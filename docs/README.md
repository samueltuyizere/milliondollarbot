# AITrader Documentation

Complete documentation for **AITrader** — an automated XAUUSD (gold) trading system built for a **FundedNext Phase 1** prop‑firm account. It pairs a Python trading bot (MetaTrader 5) with a Next.js control dashboard backed by PostgreSQL.

> **One‑line summary:** A risk‑first, single‑pair (XAUUSD) H1 EMA‑pullback bot that executes on MT5, while a web dashboard configures it, monitors it live, and enforces an auditable record of every change and trade.

---

## How to read these docs

The documents are ordered from "why" → "what" → "how". If you are new, read them in order. If you need a specific answer, jump straight to the relevant file.

| # | Document | What it covers | Best for |
|---|----------|----------------|----------|
| 01 | [Overview & Business Analysis](./01-overview-and-business-analysis.md) | Purpose, stakeholders, goals, scope, functional & non‑functional requirements, glossary | Product / BA / new joiners |
| 02 | [Architecture](./02-architecture.md) | System diagram, components, data flow, communication contract, deployment topology | Engineers, architects |
| 03 | [Trading Strategy](./03-trading-strategy.md) | The EMA pullback strategy, indicators, exact entry/exit conditions, worked examples | Traders, strategy authors |
| 04 | [Risk Management](./04-risk-management.md) | Every risk‑guard check, thresholds, the daily‑lock mechanism, lot sizing | Risk owners, traders |
| 05 | [Bot Internals](./05-bot-internals.md) | Python modules, the main loop, live vs. mock bot, demo mode, paper trading | Bot developers |
| 06 | [Dashboard](./06-dashboard.md) | Pages, components, API routes, auth, theming, modal system | Frontend / full‑stack devs |
| 07 | [Data Model](./07-data-model.md) | Full Prisma schema — every table, field, enum, relation | Anyone touching the DB |
| 08 | [Configuration Reference](./08-configuration-reference.md) | Every tunable parameter and environment variable, with defaults | Operators, traders |
| 09 | [Setup & Deployment](./09-setup-and-deployment.md) | Install, run, seed, deploy, operate (incl. paper trading on Mac) | Operators, DevOps |
| 10 | [Known Issues & Roadmap](./10-known-issues-and-roadmap.md) | Known bugs, technical debt, security notes, Phase 2 plans | Maintainers, planners |

---

## System at a glance

```
┌─────────────────────┐         HTTP (status, trades, logs)        ┌──────────────────────┐
│   Next.js Dashboard │ ◀───────────────────────────────────────── │   Python Trading Bot │
│  (UI + API routes)  │                                            │  main.py / mock_bot  │
│                     │ ─────────── PostgreSQL (config, command) ─▶ │                      │
└──────────┬──────────┘                                            └───────────┬──────────┘
           │                                                                   │
           ▼                                                                   ▼
   ┌────────────────┐                                                 ┌─────────────────┐
   │  PostgreSQL    │                                                 │  MetaTrader 5   │ (live)
   │  (shared DB)   │                                                 │  Yahoo GC=F     │ (mock)
   └────────────────┘                                                 └─────────────────┘
```

- The **dashboard writes** configuration and start/stop commands into PostgreSQL.
- The **bot reads** that config/command every loop, and **pushes** heartbeats, trades, and logs back to the dashboard over HTTP.
- **Two bot flavours** share the same strategy and risk code:
  - `main.py` — **live**, executes real orders on MetaTrader 5 (Windows only).
  - `mock_bot.py` — **paper/simulation**, uses live Yahoo gold prices, no broker (runs on macOS/Linux).

---

## Key facts (defaults)

| Aspect | Value |
|--------|-------|
| Instrument | XAUUSD (gold) — single pair, long‑only in Phase 1 |
| Strategy | H1 EMA pullback (EMA 21/50 + RSI 14 + ATR 14) |
| Account | FundedNext Phase 1, $500,000 |
| Risk per trade | 0.25% of balance |
| Max daily loss | 1.0% (hard lock) |
| Max drawdown | 4.5% (FundedNext limit is 5%) |
| Min risk:reward | 2.0 |
| Max open trades | 1 |
| Trading session | 08:00–17:00 UTC |
| Default login | `admin@aitrader.local` / `admin1234` |

See the [Configuration Reference](./08-configuration-reference.md) for the complete, authoritative list.

---

## Conventions used in these docs

- File paths are relative to the repository root (`/Applications/AMPPS/www/AITrader`).
- "Live bot" = `bot/main.py`; "mock bot" = `bot/mock_bot.py`.
- Code references include line numbers where useful, but line numbers drift — treat them as a hint, not a contract.
- ⚠️ marks a known issue or a sharp edge; these are consolidated in [Known Issues](./10-known-issues-and-roadmap.md).
