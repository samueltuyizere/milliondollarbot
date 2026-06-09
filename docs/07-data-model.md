# 07 — Data Model

> **Source:** `dashboard/prisma/schema.prisma`. PostgreSQL is the shared system of record: the dashboard reads/writes via Prisma; the bot reads directly via `psycopg2`. Prisma field names are camelCase; the physical columns/tables are snake_case via `@map`/`@@map`.

## 7.1 Entity overview

```
User ───< AuditLog

Account 1──1 BotConfig 1──1 StrategyConfig
   │             1──1 RiskRules
   └──< Trade ──< TradeLog

BotStatus      (singleton — latest row is "current")
SystemLog      (append-only bot/system events)
NewsEvent      (trading blackouts)
BankHoliday    (trading blackouts)
```

- `Account` is the hub: it owns one `BotConfig`, which owns one `StrategyConfig` and one `RiskRules`, and it has many `Trade`s.
- `BotStatus` is a logical singleton — code always reads `findFirst({ orderBy: { updatedAt: "desc" } })`.
- Phase 1 runs a single active account (`accounts.is_active = TRUE`).

---

## 7.2 Enums

| Enum | Values |
|------|--------|
| `Role` | `ADMIN`, `TRADER` |
| `BotState` | `RUNNING`, `PAUSED`, `STOPPED`, `ERROR`, `DAILY_LOCK` |
| `Direction` | `BUY`, `SELL` |
| `TradeStatus` | `PENDING`, `OPEN`, `CLOSED_WIN`, `CLOSED_LOSS`, `CLOSED_BE`, `CANCELLED` |
| `LogLevel` | `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL` |
| `NewsImpact` | `LOW`, `MEDIUM`, `HIGH` |

---

## 7.3 Models

### User → `users`
| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `id` | String | `cuid()` | PK |
| `email` | String | — | unique |
| `name` | String? | — | |
| `passwordHash` | String | — | bcrypt hash |
| `role` | Role | `TRADER` | seeded user is `ADMIN` |
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
| `botConfig` | BotConfig? | relation |
| `trades` | Trade[] | relation |

> The bot's `load_bot_config()` selects the single account where `is_active = TRUE`.

### BotConfig → `bot_configs`
| Field | Type | Default |
|-------|------|---------|
| `id` | String | `cuid()` |
| `accountId` | String | — (unique) |
| `symbol` | String | `"XAUUSD"` |
| `isRunning` | Boolean | `false` ⚠️ (loaded but unused; can drift) |
| `isPaused` | Boolean | `false` ⚠️ (same) |
| `longOnly` | Boolean | `true` |
| `sessionStart` | String | `"08:00"` |
| `sessionEnd` | String | `"17:00"` |
| `updatedAt` | DateTime | auto |
| `account` | Account | relation |
| `strategyConfig` | StrategyConfig? | relation |
| `riskRules` | RiskRules? | relation |

### BotStatus → `bot_status` (singleton)
| Field | Type | Default |
|-------|------|---------|
| `id` | String | `cuid()` |
| `status` | BotState | `STOPPED` |
| `lastPing` | DateTime? | — |
| `equity` | Float? | — |
| `balance` | Float? | — |
| `dailyPnl` | Float? | `0` |
| `peakEquity` | Float? | — |
| `drawdownPct` | Float? | `0` |
| `openTrades` | Int | `0` |
| `errorMsg` | String? | — |
| `botMode` | String? | — (`"mock"` \| `"live"`) |
| `updatedAt` | DateTime | auto / `now()` |

This row is the contract surface between bot and dashboard: the bot writes it via heartbeats; the dashboard reads it for the status pill, KPIs, and the `start/stop/...` command (`status`).

### StrategyConfig → `strategy_configs`
| Field | Type | Default |
|-------|------|---------|
| `id` | String | `cuid()` |
| `botConfigId` | String | — (unique) |
| `emaFast` | Int | `21` |
| `emaSlow` | Int | `50` |
| `rsiPeriod` | Int | `14` |
| `rsiOversold` | Float | `40.0` |
| `atrPeriod` | Int | `14` |
| `atrMultiSl` | Float | `1.5` |
| `timeframe` | String | `"H1"` |
| `updatedAt` | DateTime | auto |

### RiskRules → `risk_rules`
| Field | Type | Default |
|-------|------|---------|
| `id` | String | `cuid()` |
| `botConfigId` | String | — (unique) |
| `riskPerTradePct` | Float | `0.25` |
| `maxDailyLossPct` | Float | `1.0` |
| `maxDrawdownPct` | Float | `4.5` |
| `minRR` | Float | `2.0` |
| `maxOpenTrades` | Int | `1` |
| `dailyLockActive` | Boolean | `false` |
| `updatedAt` | DateTime | auto |

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
| `createdAt` | DateTime | `now()` |
| `account` | Account | relation |
| `logs` | TradeLog[] | relation |

`status` is derived on close from P&L: `CLOSED_WIN` / `CLOSED_LOSS` / `CLOSED_BE`. `manualClose=true` is the flag the bot polls to close a position on request.

### TradeLog → `trade_logs`
| Field | Type | Default |
|-------|------|---------|
| `id` | String | `cuid()` |
| `tradeId` | String | — |
| `event` | String | — (e.g. `"OPENED"`) |
| `message` | String | — |
| `createdAt` | DateTime | `now()` |
| `trade` | Trade | relation |

### SystemLog → `system_logs`
| Field | Type | Default |
|-------|------|---------|
| `id` | String | `cuid()` |
| `level` | LogLevel | — |
| `source` | String | — (e.g. `"mock"`, `"risk"`, `"strategy"`, `"market"`) |
| `message` | String | — |
| `metadata` | Json? | — |
| `createdAt` | DateTime | `now()` |

Written by the bot's `log()` via `POST /api/logs/system`.

### NewsEvent → `news_events`
| Field | Type | Default |
|-------|------|---------|
| `id` | String | `cuid()` |
| `title` | String | — |
| `currency` | String | `"USD"` |
| `impact` | NewsImpact | `HIGH` |
| `eventTime` | DateTime | — |
| `skipTrading` | Boolean | `true` |
| `minutesBefore` | Int | `30` |
| `minutesAfter` | Int | `30` |
| `createdAt` | DateTime | `now()` |

The risk guard blocks trades within `[eventTime − minutesBefore, eventTime + minutesAfter]` for events with `skipTrading = true`.

### BankHoliday → `bank_holidays`
| Field | Type | Default |
|-------|------|---------|
| `id` | String | `cuid()` |
| `country` | String | — |
| `name` | String | — |
| `date` | DateTime | — |
| `description` | String? | — |
| `createdAt` | DateTime | `now()` |

Any holiday dated today blocks trading.

### AuditLog → `audit_logs`
| Field | Type | Default |
|-------|------|---------|
| `id` | String | `cuid()` |
| `userId` | String? | — ⚠️ often null (see below) |
| `action` | String | — (e.g. `config.risk.update`, `bot.control`) |
| `resource` | String? | — |
| `oldValue` | Json? | — |
| `newValue` | Json? | — |
| `ipAddress` | String? | — |
| `createdAt` | DateTime | `now()` |
| `user` | User? | relation |

> ⚠️ `logAudit()` is currently called without the session user in API routes, so `userId` is typically null. Tracked in [Known Issues](./10-known-issues-and-roadmap.md).

---

## 7.4 Who writes what

| Table | Written by | Read by |
|-------|-----------|---------|
| `users` | seed / admin | Auth |
| `accounts` | seed / dashboard | bot (`load_bot_config`), dashboard |
| `bot_configs`, `strategy_configs`, `risk_rules` | dashboard (config APIs) | bot (`load_bot_config`), dashboard |
| `bot_status` | **bot** (heartbeat) + dashboard (control) | both |
| `trades` | **bot** (open/close) + dashboard (manual‑close flag) | both |
| `trade_logs` | dashboard (on trade open) | dashboard |
| `system_logs` | **bot** (`log()`) | dashboard |
| `news_events`, `bank_holidays` | dashboard (calendar) | bot (risk guard), dashboard |
| `audit_logs` | dashboard (config/control) | dashboard |

---

## 7.5 Migrations & seeding

- Schema changes: `npx prisma migrate dev --name <change>` (generates SQL + applies it).
- Client regen: `npx prisma generate`.
- Seed data: `npx prisma db seed` (runs `prisma/seed.ts`) — creates the admin user, the Phase‑1 account, and default config/strategy/risk rows plus a STOPPED `bot_status`.

See [09 — Setup & Deployment](./09-setup-and-deployment.md) for the full bootstrap sequence.

---

Next: [08 — Configuration Reference](./08-configuration-reference.md)
