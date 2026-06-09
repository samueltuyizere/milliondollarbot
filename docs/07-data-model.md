# 07 — Data Model

> **Source:** `dashboard/prisma/schema.prisma`. PostgreSQL is the shared system of record: the dashboard reads/writes via Prisma; the bot reads directly via `psycopg2`. Prisma field names are camelCase; the physical columns/tables are snake_case via `@map`/`@@map`.

## 7.1 Entity overview

```
Role ──< Permission  (M:N via _PermissionToRole)
User >── Role

User ───< AuditLog

Account 1──1 BotConfig 1──1 StrategyConfig
   │             1──1 RiskRules
   └──< Trade ──< TradeLog

BotStatus      (singleton — latest row is "current")
SystemLog      (append-only bot/system events)
NewsEvent      (trading blackouts)
BankHoliday    (trading blackouts)
```

- `Role` and `Permission` form the RBAC layer. `User.roleId` FK ties each user to exactly one role.
- `Account` is the trading hub: it owns one `BotConfig`, which owns one `StrategyConfig` and one `RiskRules`, and has many `Trade`s.
- `BotStatus` is a logical singleton — code always reads `findFirst({ orderBy: { updatedAt: "desc" } })`.
- Phase 1 runs a single active account (`accounts.is_active = TRUE`).

---

## 7.2 Enums

| Enum | Values |
|------|--------|
| `BotState` | `RUNNING`, `PAUSED`, `STOPPED`, `ERROR`, `DAILY_LOCK` |
| `Direction` | `BUY`, `SELL` |
| `TradeStatus` | `PENDING`, `OPEN`, `CLOSED_WIN`, `CLOSED_LOSS`, `CLOSED_BE`, `CANCELLED` |
| `LogLevel` | `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL` |
| `NewsImpact` | `LOW`, `MEDIUM`, `HIGH` |

> The old `Role` enum (`ADMIN`/`TRADER`) was replaced by the `Role` model in migration `20260609174000_add_rbac`.

---

## 7.3 Models

### Role → `roles`
| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `id` | String | `cuid()` | PK |
| `name` | String | — | unique (e.g. `"ADMIN"`, `"TRADER"`) |
| `description` | String? | — | |
| `isSystem` | Boolean | `false` | System roles (`ADMIN`) cannot be deleted |
| `createdAt` / `updatedAt` | DateTime | `now()` / auto | |
| `permissions` | Permission[] | — | M:N via `_PermissionToRole` |
| `users` | User[] | — | relation |

Seeded system roles: `ADMIN` (id `role_admin_sys`), `TRADER` (id `role_trader_sys`).

### Permission → `permissions`
| Field | Type | Notes |
|-------|------|-------|
| `id` | String | `cuid()`, PK |
| `code` | String | unique — e.g. `"bot.control"`, `"users.manage"` |
| `description` | String? | Human-readable label |
| `category` | String? | Groups codes in the UI: `dashboard`, `trades`, `bot`, `config`, `risk`, `users`, `roles` |
| `createdAt` | DateTime | `now()` |
| `roles` | Role[] | M:N back-relation |

15 codes seeded by migration `20260609174000_add_rbac`.

### User → `users`
| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `id` | String | `cuid()` | PK |
| `email` | String | — | unique |
| `name` | String? | — | |
| `passwordHash` | String | — | bcrypt cost 12 |
| `roleId` | String | — | FK → `roles.id` |
| `role` | Role | — | relation |
| `isActive` | Boolean | `true` | inactive users cannot log in |
| `passwordChangeRequired` | Boolean | `false` | set `true` when admin creates a user without explicit password |
| `createdAt` / `updatedAt` | DateTime | `now()` / auto | |
| `auditLogs` | AuditLog[] | — | relation |

### Account → `accounts`
| Field | Type | Default |
|-------|------|---------|
| `id` | String | `cuid()` |
| `name` | String | — |
| `broker` | String | `"FundedNext"` |
| `accountNumber` | String? | — |
| `balance` | Float | `500000` |
| `currency` | String | `"USD"` |
| `drawdownLimit` | Float | `5.0` |
| `dailyLossLimit` | Float | `1.0` |
| `isActive` | Boolean | `true` |
| `phase` | String | `"Phase 1"` |
| `createdAt`/`updatedAt` | DateTime | `now()`/auto |

> The bot's `load_bot_config()` selects the single account where `is_active = TRUE`.

### BotConfig → `bot_configs`
| Field | Type | Default |
|-------|------|---------|
| `symbol` | String | `"XAUUSD"` |
| `isRunning` | Boolean | `false` ⚠️ (loaded but unused; can drift) |
| `isPaused` | Boolean | `false` ⚠️ |
| `longOnly` | Boolean | `true` |
| `sessionStart` | String | `"08:00"` |
| `sessionEnd` | String | `"17:00"` |

### BotStatus → `bot_status` (singleton)
| Field | Type | Default |
|-------|------|---------|
| `status` | BotState | `STOPPED` |
| `lastPing` | DateTime? | — |
| `equity` | Float? | — |
| `balance` | Float? | — |
| `dailyPnl` | Float? | `0` |
| `peakEquity` | Float? | — |
| `drawdownPct` | Float? | `0` |
| `openTrades` | Int | `0` |
| `errorMsg` | String? | — |
| `botMode` | String? | `"mock"` \| `"live"` |

This row is the contract surface between bot and dashboard: the bot writes it via heartbeats; the dashboard reads it for the status pill, KPIs, and the `start/stop/...` command.

### StrategyConfig → `strategy_configs`
| Field | Type | Default |
|-------|------|---------|
| `emaFast` | Int | `21` |
| `emaSlow` | Int | `50` |
| `rsiPeriod` | Int | `14` |
| `rsiOversold` | Float | `40.0` |
| `atrPeriod` | Int | `14` |
| `atrMultiSl` | Float | `1.5` |
| `timeframe` | String | `"H1"` |

### RiskRules → `risk_rules`
| Field | Type | Default |
|-------|------|---------|
| `riskPerTradePct` | Float | `0.25` |
| `maxDailyLossPct` | Float | `1.0` |
| `maxDrawdownPct` | Float | `4.5` |
| `minRR` | Float | `2.0` |
| `maxOpenTrades` | Int | `1` |
| `dailyLockActive` | Boolean | `false` |

### Trade → `trades`
| Field | Type | Default |
|-------|------|---------|
| `id` | String | `cuid()` |
| `accountId` | String | — |
| `symbol` | String | `"XAUUSD"` |
| `direction` | Direction | — |
| `entryPrice` | Float | — |
| `stopLoss` | Float | — |
| `takeProfit` | Float | — |
| `lotSize` | Float | — |
| `mt5Ticket` | Int? | — (unique; paper tickets ≥ 900,000) |
| `status` | TradeStatus | `OPEN` |
| `openTime` | DateTime | `now()` |
| `closeTime` | DateTime? | — |
| `closePrice` | Float? | — |
| `pnl` | Float? | — |
| `pnlPct` | Float? | — |
| `commission` | Float? | — |
| `swap` | Float? | — |
| `notes` | String? | — |
| `manualClose` | Boolean | `false` |

`status` is derived on close from P&L: `CLOSED_WIN` / `CLOSED_LOSS` / `CLOSED_BE`. `manualClose=true` is the flag the bot polls to close a position on request.

### TradeLog → `trade_logs`
Events attached to a trade (e.g. `"OPENED"`, `"MANUAL_CLOSE_REQUESTED"`).

### SystemLog → `system_logs`
Written by the bot's `log()` via `POST /api/logs/system`. Level, source, message, optional JSON metadata.

### NewsEvent → `news_events`
Trading blackout windows. The risk guard blocks trades within `[eventTime − minutesBefore, eventTime + minutesAfter]` for events with `skipTrading = true`.

### BankHoliday → `bank_holidays`
Any holiday dated today blocks trading.

### AuditLog → `audit_logs`
Config and control changes written by dashboard API routes. `userId` is currently often null (tracked in Known Issues D‑4).

---

## 7.4 Who writes what

| Table | Written by | Read by |
|-------|-----------|---------|
| `roles`, `permissions`, `_PermissionToRole` | seed / admin (via `/api/roles`) | Auth (login), dashboard |
| `users` | seed / admin (via `/api/users`) | Auth, dashboard |
| `accounts` | seed / dashboard | bot (`load_bot_config`), dashboard |
| `bot_configs`, `strategy_configs`, `risk_rules` | dashboard (config APIs) | bot, dashboard |
| `bot_status` | **bot** (heartbeat) + dashboard (control) | both |
| `trades` | **bot** (open/close) + dashboard (manual‑close flag) | both |
| `trade_logs` | dashboard (on trade open) | dashboard |
| `system_logs` | **bot** (`log()`) | dashboard |
| `news_events`, `bank_holidays` | dashboard (calendar) | bot (risk guard), dashboard |
| `audit_logs` | dashboard (config/control) | dashboard |

---

## 7.5 Migrations

| Migration | Change |
|-----------|--------|
| `20260608212246_init` | Initial schema |
| `20260609084137_add_bot_mode` | `bot_status.bot_mode` column |
| `20260609133904_add_manual_close` | `trades.manual_close` column |
| `20260609174000_add_rbac` | Drop `Role` enum; add `roles`, `permissions`, `_PermissionToRole` tables; add `role_id`, `is_active`, `password_change_required` to `users`; seed 2 system roles + 15 permissions |

**Applying migrations:**
```bash
cd dashboard
npx prisma migrate deploy   # apply pending migrations
npx prisma generate         # regenerate Prisma client
npx prisma db seed          # (re)seed default data
```

---

Next: [08 — Configuration Reference](./08-configuration-reference.md)
