# 10 — Known Issues & Roadmap

This document consolidates the known bugs, technical debt, and security notes flagged throughout the codebase, plus the planned roadmap. Each item notes where it lives.

## 10.1 Known bugs

| # | Issue | Location | Impact | Suggested fix |
|---|-------|----------|--------|---------------|
| B‑1 | **STOPPED path uses undefined variables** — `equity`/`balance` referenced before assignment and a non‑imported `open_positions(...)` is called. | `bot/main.py` (STOPPED branch) | `NameError` each loop if the live bot runs while the dashboard says STOPPED. | Compute account info before the command switch; use `get_open_positions()`. |
| B‑2 | **Daily‑lock not cleared on restart** — control API sets `bot_status = RUNNING` but leaves `risk_rules.daily_lock_active = true`. | `/api/bot/control`, `risk_guard` | Bot may immediately re‑lock after a manual restart. | On `start`, also set `daily_lock_active = false`. |
| B‑3 | **Mock shutdown double‑counts P&L** — `final_equity = base_balance + state.total_pnl + today_pnl`, but `total_pnl` already includes today's closes. | `bot/mock_bot.py` shutdown | Incorrect final equity figure at shutdown. | Subtract today's portion or recompute from closed trades. |
| B‑4 | **Live bot ignores manual close** — only the mock bot polls `trades.manual_close`. | `bot/main.py` | "Close" button has no effect in live mode. | Add a `manual_close` poll + `close_position()` call in the live loop. |
| B‑5 | **P&L semantics mismatch** — live `today_pnl` is floating (open positions), but the risk guard's daily‑loss check reads realized closed P&L from the DB. | `main.py` vs `risk_guard.py` | Daily‑loss gate may not reflect large unrealized losses. | Unify on realized + unrealized for the daily check. |

## 10.2 Technical debt / correctness gaps

| # | Item | Location | Notes |
|---|------|----------|-------|
| D‑1 | **Session window is same‑day only** — string compare of `"%H:%M"`. | `risk_guard._check_session` | Overnight windows (e.g. 22:00–06:00) won't work. Use proper time math. |
| D‑2 | **`accounts.balance` is static** — not synced from the live MT5 account. | `accounts`, `main.py` | Sizing/limits can diverge from real equity. Periodically write MT5 balance back. |
| D‑3 | **`bot_configs.is_running` / `is_paused` unused** — loaded but never acted on. | `config.py`, schema | Can drift from `bot_status.status`. Remove or keep in sync. |
| D‑4 | **`audit_logs.userId` usually null** — `logAudit()` called without the session user. | dashboard API routes | Weakens the audit trail. Pass `session.user.id`. |
| D‑5 | **Drawdown peak lags** — read from last heartbeat (`bot_status.peak_equity`). | `risk_guard._check_drawdown` | Slight lag vs true peak. |
| D‑6 | **`_send_hb` reports `open_trades = 0`** for PAUSED/DAILY_LOCK/ERROR. | `main.py` | UI open‑trade count can read 0 in those states. |
| D‑7 | **Unused dependencies** — `ta`, `schedule`, `pytz` are installed but unused. | `bot/requirements.txt` | Trim to reduce surface. |
| D‑8 | **No automated tests** anywhere. | repo | Add unit tests for `check_signal` and `RiskGuard.check_all`. |

## 10.3 Security notes

| # | Note | Detail |
|---|------|--------|
| S‑1 | **Public bot API routes** — `/api/bot/heartbeat`, `/api/trades*`, `/api/logs/system` bypass auth. | Fine for a localhost‑only deployment; **must** be firewalled or secret‑gated before any network exposure. |
| S‑2 | **Roles are cosmetic** — no route enforces ADMIN vs TRADER. | All authenticated users have full access. Add RBAC if multi‑user. |
| S‑3 | **Seeded credentials** — `admin@aitrader.local` / `admin1234`. | Rotate before any shared/production use; set a strong `AUTH_SECRET`. |
| S‑4 | **Daily lock is intentionally UI‑immutable** — only a manual restart clears the status. | This is a *feature* (prevents over‑riding a breach), but pair it with B‑2's flag clearing. |

## 10.4 Demo‑mode reminder

- `DEMO_LOOSE=1` forces the strategy to fire on every cycle (with a small R:R buffer). Use only for UI demos. Trades and equity curves produced under it are **not** meaningful. Always run without the flag to evaluate real behaviour. (See [03 — Trading Strategy §3.7](./03-trading-strategy.md#37--demo-mode-demo_loose).)

## 10.5 Roadmap (Phase 2+)

| Item | Description |
|------|-------------|
| **Remote sync (FR‑06 cloud)** | Replicate PostgreSQL to a cloud DB (Neon/Supabase) for backup and mobile access. |
| **Mobile app** | React Native client over the cloud DB. |
| **Multi‑pair support** | Trade beyond XAUUSD; per‑symbol config and specs. |
| **Short side** | Enable and validate the existing SELL path (`long_only = false`). |
| **Backtesting UI** | Replay historical data through `check_signal` + `RiskGuard`. |
| **Alerting** | Email / Telegram notifications on trades, locks, and errors. |
| **RBAC** | Enforce ADMIN vs TRADER permissions. |
| **Hardening** | Localhost/secret‑gate bot endpoints, fix B‑1..B‑5, add tests. |

## 10.6 Priority suggestion

If taking this toward live, unattended operation, address in this order:

1. **B‑1** (STOPPED crash) and **B‑2** (lock not cleared) — these break core control.
2. **S‑1** (lock down bot endpoints) and **S‑3** (credentials/secret).
3. **D‑2 / B‑5** (balance sync + unified daily P&L) — correctness of the risk gate.
4. **B‑4** (live manual close), **D‑4** (audit user), then **D‑8** (tests).

---

Back to the [Documentation Index](./README.md).
