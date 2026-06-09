# 10 — Known Issues & Roadmap

This document consolidates the known bugs, technical debt, and security notes flagged throughout the codebase, plus the planned roadmap.

## 10.1 Known bugs

| # | Issue | Location | Impact | Status |
|---|-------|----------|--------|--------|
| B‑1 | **STOPPED path uses undefined variables** — `equity`/`balance` referenced before assignment; `open_positions(...)` not imported. | `bot/main.py` (STOPPED branch) | `NameError` each loop when live bot runs in STOPPED state. | ✅ Fixed — `_send_hb` used in all non-RUNNING branches |
| B‑2 | **Daily‑lock not cleared on restart** — control API sets `bot_status = RUNNING` but left `risk_rules.daily_lock_active = true`. | `/api/bot/control` | Bot re-locked immediately after manual restart. | ✅ Fixed — `dailyLockActive = false` on `start` command |
| B‑3 | **Mock shutdown double‑counts P&L** — `final_equity = base_balance + state.total_pnl + today_pnl`, but `total_pnl` already includes today's closes. | `bot/mock_bot.py` shutdown | Incorrect final equity figure at shutdown. | ⚠️ Open |
| B‑4 | **Live bot ignores manual close** — only the mock bot polled `trades.manual_close`. | `bot/main.py` | "Close" button had no effect in live mode. | ✅ Fixed — `_check_manual_close_requests` added to live bot |
| B‑5 | **Floating P&L excluded from daily loss check** — risk guard only checked realized closed P&L. | `risk_guard.py` | Daily‑loss gate could miss large unrealized losses. | ✅ Fixed — `floating_pnl` passed to `check_all` and `_check_daily_loss` |

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
| S‑1 | **Public bot API routes** — `/api/bot/heartbeat`, `/api/trades*`, `/api/logs/system` bypass auth. | Fine for localhost‑only; **must** be firewalled or secret‑gated before any network exposure. |
| S‑2 | **RBAC implemented** — roles and permissions are enforced on routes and APIs. | ✅ Done — 15 permission codes, route guards in `proxy.ts`, `requirePermission` in API handlers |
| S‑3 | **Seeded credentials** — `admin@aitrader.local` / `admin1234`. | Rotate via `/settings/users` before any shared/production use; set a strong `AUTH_SECRET`. |
| S‑4 | **Daily lock is intentionally UI‑immutable** — only a manual restart clears the status. | This is a *feature* (prevents overriding a breach). Paired with B‑2's fix so it clears cleanly on restart. |

## 10.4 Demo‑mode reminder

- `DEMO_LOOSE=1` forces the strategy to fire on every cycle. Use only for UI demos. Trades and equity curves produced under it are **not** meaningful. Always run without the flag to evaluate real behaviour. (See [03 — Trading Strategy §3.7](./03-trading-strategy.md#37--demo-mode-demo_loose).)

## 10.5 Roadmap (Phase 2+)

| Item | Description |
|------|-------------|
| **Remote sync** | Replicate PostgreSQL to a cloud DB (Neon/Supabase) for backup and mobile access. |
| **Mobile app** | React Native client over the cloud DB. |
| **Multi‑pair support** | Trade beyond XAUUSD; per‑symbol config and specs. |
| **Short side** | Enable and validate the existing SELL path (`long_only = false`). |
| **Backtesting UI** | Replay historical data through `check_signal` + `RiskGuard`. |
| **Alerting** | Email / Telegram notifications on trades, locks, and errors. |
| **Balance sync** | Periodically write live MT5 balance back to `accounts.balance` (D‑2). |
| **Audit user IDs** | Pass `session.user.id` to `logAudit()` in all API routes (D‑4). |
| **Tests** | Unit tests for `check_signal`, `RiskGuard.check_all`, and API route handlers (D‑8). |

## 10.6 Priority suggestion

For live, unattended operation, address in this order:

1. **S‑1** (lock down bot endpoints) and **S‑3** (rotate credentials/secret).
2. **D‑2** (balance sync) — correctness of the risk gate with real equity.
3. **D‑4** (audit user IDs) — improves traceability.
4. **B‑3** (mock shutdown P&L) and **D‑8** (tests).

---

Back to the [Documentation Index](./README.md).
