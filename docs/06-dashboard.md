# 06 — Dashboard

> **Source:** the `dashboard/` directory (Next.js 16 App Router). For the database schema see [07](./07-data-model.md); for every API route's request/response see this document.

## 6.1 Tech stack

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | Next.js (App Router, Turbopack) | 16.2.7 |
| UI runtime | React / React DOM | 19.2.4 |
| Auth | Auth.js v5 (`next-auth`) | 5.0.0‑beta |
| ORM | Prisma / `@prisma/client` | 5.x |
| DB | PostgreSQL | — |
| Styling | Tailwind CSS | 4 |
| Components | shadcn (`base-nova`) + `@base-ui/react` | — |
| Charts | Recharts | 3.x |
| Theming | `next-themes` | 0.4 |
| Icons / toasts | `lucide-react`, `sonner` | — |
| Password hashing | `bcryptjs` | 3.x |

**Next.js 16 specifics:** Turbopack is the default dev bundler (no flag). Route protection lives in **`src/proxy.ts`** — Next.js 16's rename of `middleware.ts`. Fonts: Space Grotesk (sans) + JetBrains Mono (mono). Path alias `@/*` → `src/*`.

---

## 6.2 Authentication & RBAC

### Configuration — `src/lib/auth.ts`
- **Credentials provider** only. `authorize()` looks up the `User` by email, verifies the password with `bcrypt.compare`, and loads the user's role + all its permissions from the DB.
- **JWT sessions** (no DB session store). The `jwt` callback embeds `id`, `role` (role name string), `permissions` (array of permission codes), and `passwordChangeRequired` on the token. The `session` callback exposes all four on `session.user`.
- Permissions are resolved **at login** — no per-request DB lookups on the client.
- Custom sign‑in page: `/login`. Exports `handlers`, `auth`, `signIn`, `signOut`.

### Route protection — `src/proxy.ts`
```
Public (no session): /api/auth/*, /api/bot/heartbeat, /api/trades/*, /api/logs/system
/login              → redirect to /dashboard when already logged in
/settings/users     → requires users.view permission (403 page if missing)
/settings/roles     → requires roles.view permission
/api/users          → requires users.view permission (403 JSON if missing)
/api/roles          → requires roles.view permission
/api/permissions    → requires roles.view permission
everything else     → requires authentication
```

### Permission model — `src/lib/permissions.ts`
15 granular permission codes across 7 categories:

| Category | Codes |
|----------|-------|
| `dashboard` | `dashboard.view` |
| `trades` | `trades.view`, `trades.close` |
| `bot` | `bot.view`, `bot.control` |
| `config` | `config.view`, `config.edit` |
| `risk` | `risk.view`, `risk.edit` |
| `users` | `users.view`, `users.create`, `users.edit`, `users.delete` |
| `roles` | `roles.view`, `roles.manage` |

**ADMIN** receives all 15. **TRADER** receives 6 (view-only: dashboard, trades, bot, config, risk + trades.close).

Server-side helpers: `requirePermission(code)` and `requireAllPermissions(...codes)` — used in every protected API route handler.

### TypeScript types — `src/types/next-auth.d.ts`
Module augmentation adds `role: string`, `permissions: string[]`, and `passwordChangeRequired: boolean` to `Session.user` and `JWT`.

### Client hook — `src/hooks/use-permissions.ts`
`usePermissions()` returns `{ role, permissions, can(code), canAny(...codes), canAll(...codes) }` — reads from `useSession()`.

### Default roles
| Role | System | Permissions |
|------|--------|-------------|
| `ADMIN` | ✓ locked | All 15 |
| `TRADER` | ✗ editable | 6 (view + trades.close) |

System roles (`isSystem: true`) cannot be deleted. Additional roles can be created freely from `/settings/roles`.

### Seeded login
`admin@aitrader.local` / `admin1234` (bcrypt cost 12, `passwordChangeRequired: false`). Role: `ADMIN`.

---

## 6.3 Pages

| Route | File | Rendering | Purpose |
|-------|------|-----------|---------|
| `/` | `app/page.tsx` | Server | Redirects to `/dashboard` |
| `/login` | `app/login/page.tsx` | Client | Credentials form + animated XAUUSD hero (outside the app shell) |
| `/dashboard` | `app/(dashboard)/dashboard/page.tsx` | Client | 5 KPI cards (Equity, Daily P&L, Drawdown, Open Trades, Drawdown visual), equity area chart, outcome donut, recent trades table with **live floating P&L** + row-click detail modal. Polls every 5 s; price every 4 s |
| `/trades` | `app/(dashboard)/trades/page.tsx` | Client | Full trade history: summary pills, All/Open/Closed filter, pagination (20/page), row-click detail modal |
| `/calendar` | `app/(dashboard)/calendar/page.tsx` | Client | Tabs: News Events (CRUD) + Bank Holidays (CRUD) |
| `/logs` | `app/(dashboard)/logs/page.tsx` | Client | Tabs: System (level filter), Trade, Audit logs |
| `/settings/users` | `app/(dashboard)/settings/users/page.tsx` | Client | User management table — create/edit/delete/activate with role assignment. Requires `users.view` |
| `/settings/roles` | `app/(dashboard)/settings/roles/page.tsx` | Client | Role cards with expandable permission list; create/edit modal with per-category checkbox grid. Requires `roles.view` |
| `/403` | `app/403/page.tsx` | Server | Access-denied page (redirected to by `proxy.ts`) |
| `/bot` | `app/(dashboard)/bot/page.tsx` | Server | Redirect → `/dashboard?panel=bot` |
| `/config` | `app/(dashboard)/config/page.tsx` | Server | Redirect → `/dashboard?panel=config` |

All `(dashboard)` pages are wrapped by `app/(dashboard)/layout.tsx` → `AppShell`.

---

## 6.4 Layout & component architecture

### Shell (`src/components/layout/`)
| Component | Responsibility |
|-----------|----------------|
| `AppShell` | Hosts `ModalProvider`, sidebar, header, main content, `PanelUrlSync`, `AppModals`. Persists sidebar‑collapsed in `localStorage` (`aitrader_sidebar_collapsed`) |
| `Sidebar` | **Trading** section (Dashboard, Trades, Calendar, Logs) + modal triggers (Bot Control, Configuration) + **Settings** section (Users, Roles — filtered by permissions via `usePermissions`); user avatar/role; collapsible |
| `Header` | Page title (with prefix-aware lookup for `/settings/*`), `PriceTicker`, `ThemeToggle`, `BotStatusPill` (with `BotModeBadge`), user dropdown |
| `PriceTicker` | Polls `/api/market/price` every 15 s; shows spot price + day‑change %, flashes on change |
| `ThemeToggle` | Light/dark switch via `next-themes` |
| `AppModals` | Bot Control and Configuration dialogs |
| `PanelUrlSync` | Reads `?panel=bot|config`, opens the corresponding modal, then cleans the URL |

### Modal system
- `src/context/modal-context.tsx` — `ModalProvider` + `useModals()`, state `modal: "bot" | "config" | null`.

### Feature panels
| Component | Responsibility |
|-----------|----------------|
| `bot/bot-control-panel.tsx` | Polls `/api/bot/status` (every 3 s while open); Start/Pause/Stop/Resume → `POST /api/bot/control`; KPI + heartbeat display |
| `config/config-panel.tsx` | Tabs: Risk (`/api/config/risk`), Strategy (`/api/config/strategy`), Bot settings (`/api/config/bot`); saves via PUT |

### Charts (`src/components/charts/`, data in `src/lib/charts/trade-stats.ts`)
| Component | Shows |
|-----------|-------|
| `EquityAreaChart` | Cumulative equity curve (`buildEquitySeries`). Height: 340px |
| `TradeOutcomeDonut` | Win/loss/BE/open breakdown with win‑rate center (`buildOutcomeBreakdown`, `calcWinRate`). Legend centered below chart. **Win color = gold** (brand primary) |
| `ChartPanel` | Shared card wrapper + empty‑state |

**Chart colors:** Wins → gold (`oklch(0.78 0.16 75)`), Losses → red, Break-even → muted, Open → blue-muted.

### Trade detail modal (`src/components/ui/trade-detail-modal.tsx`)
Clicking any trade row on `/dashboard` or `/trades` opens a detail modal showing:
- Direction icon + symbol + status badge
- P&L hero — floating (live, with pulse dot) for open trades, realized for closed
- Details grid: lot size, entry, close price (if closed), SL (red), TP (green), R:R ratio, opened/closed timestamps
- **Close position button** (open trades only) — triggers the confirm dialog

### Dashboard KPI cards
5 cards in `grid-cols-2 lg:grid-cols-5`:
1. **Equity** — current equity vs balance
2. **Daily P&L** — realized + % of balance
3. **Drawdown** — % with tone coloring
4. **Open Trades** — count + last ping
5. **Drawdown visual** — mini progress bar, status label, border/bg tint changes color at 3 severity levels:
   - 0–1.5% → green "Healthy"
   - 1.5–3% → amber "Caution — monitor closely"
   - 3–4.5% → red "⚠ Critical — near limit"

### UI primitives (`src/components/ui/`)
`alert-banner`, `bot-mode-badge`, `status-badge`, `stat-card`, `section-header`, `trade-detail-modal`, `field-row`, `empty-state`, `dialog`, `checkbox`, plus shadcn primitives (`button`, `input`, `switch`, `tabs`, `select`, `textarea`, …) and `sonner` toasts.

---

## 6.5 API routes (complete)

**Legend:** 🔓 Public (bot, no session) · 🔒 Session required · 🛡 Permission required

### Auth
| Method | Route | | Purpose |
|--------|-------|---|---------|
| GET/POST | `/api/auth/[...nextauth]` | 🔓 | Auth.js session endpoints |

### Bot
| Method | Route | | Request → Response |
|--------|-------|---|--------------------|
| GET | `/api/bot/status` | 🔒 | → `{ status: BotStatus \| defaults }` |
| POST | `/api/bot/heartbeat` | 🔓 | `{ status?, equity?, balance?, dailyPnl?, peakEquity?, drawdownPct?, openTrades?, errorMsg?, botMode? }` → `{ ok: true }`; upserts latest `BotStatus` |
| POST | `/api/bot/control` | 🔒 | `{ command: "start"\|"stop"\|"pause"\|"resume" }` → `{ ok, status }`; blocks non‑start while `DAILY_LOCK`; clears `daily_lock_active` on start; writes audit + system log |

### Trades
| Method | Route | | Request → Response |
|--------|-------|---|--------------------|
| GET | `/api/trades` | 🔓 | `?limit=50&status=OPEN` → `{ trades: Trade[] }` |
| POST | `/api/trades` | 🔓 | `{ accountId, direction, entryPrice, stopLoss, takeProfit, lotSize, symbol?, mt5Ticket? }` → `{ ok, trade }` |
| POST | `/api/trades/[id]/close` | 🔓 | `{ closePrice, pnl?, commission?, swap? }` → `{ ok, trade }` |
| POST | `/api/trades/[id]/manual-close` | 🔒 | → `{ ok }`; sets `manualClose: true` for bot to honour |

### Config
| Method | Route | | Fields |
|--------|-------|---|--------|
| GET/PUT | `/api/config/bot` | 🔒 | `longOnly, sessionStart, sessionEnd` |
| GET/PUT | `/api/config/risk` | 🔒 | `riskPerTradePct, maxDailyLossPct, maxDrawdownPct, minRR, maxOpenTrades` |
| GET/PUT | `/api/config/strategy` | 🔒 | `emaFast, emaSlow, rsiPeriod, rsiOversold, atrPeriod, atrMultiSl` |

### Logs
| Method | Route | | |
|--------|-------|---|---|
| GET/POST | `/api/logs/system` | 🔓 | GET `?limit=100&level=` → `{ logs }`; POST `{ level, source, message, metadata? }` |
| GET | `/api/logs/trades` | 🔒 | `?limit=100` → `{ logs: TradeLog[] }` |
| GET | `/api/logs/audit` | 🔒 | `?limit=100` → `{ logs: AuditLog[] }` |

### Calendar
| Method | Route | | |
|--------|-------|---|---|
| GET/POST | `/api/calendar/news` | 🔒 | List / create news events |
| DELETE | `/api/calendar/news/[id]` | 🔒 | Delete a news event |
| GET/POST | `/api/calendar/holidays` | 🔒 | List / create bank holidays |
| DELETE | `/api/calendar/holidays/[id]` | 🔒 | Delete a holiday |

### Market
| Method | Route | | Response |
|--------|-------|---|----------|
| GET | `/api/market/price` | 🔒 | `{ symbol, price, refPrice, previousClose, change, changePct, currency, marketState, fetchedAt }` |

**Price route:** `price` = spot gold from `api.gold-api.com`; `refPrice` = futures `GC=F` from Yahoo (used for floating P&L). Results cached 15 s with stale-fallback.

### RBAC
| Method | Route | | |
|--------|-------|---|---|
| GET | `/api/permissions` | 🛡 roles.view | All permission codes, grouped by category |
| GET | `/api/roles` | 🛡 roles.view | All roles with permissions + user count |
| POST | `/api/roles` | 🛡 roles.manage | Create role: `{ name, description?, permissionIds? }` |
| GET | `/api/roles/[id]` | 🛡 roles.view | Role detail |
| PUT | `/api/roles/[id]` | 🛡 roles.manage | Update description + permission set (`set` semantics) |
| DELETE | `/api/roles/[id]` | 🛡 roles.manage | Delete (blocked if system role or has users) |
| GET | `/api/users` | 🛡 users.view | All users (no passwordHash) |
| POST | `/api/users` | 🛡 users.create | Create: `{ email, name?, roleId, password? }` (default password `Password1!`, `passwordChangeRequired: true`) |
| GET | `/api/users/[id]` | 🛡 users.view | User detail |
| PUT | `/api/users/[id]` | 🛡 users.edit | Update name/email/role/isActive/password |
| DELETE | `/api/users/[id]` | 🛡 users.delete | Delete (cannot delete self) |

---

## 6.6 Live floating P&L & manual close

On `/dashboard` and `/trades`:
- Polls `/api/market/price` every 4 s; computes floating P&L as `(refPrice − entry) × lot × 100` (negated for SELL) — same formula and same futures price the bot uses.
- Open rows show a pulsing "live" dot; dashboard header shows combined floating total.
- Clicking any trade row opens `TradeDetailModal` with full trade details. Open trades show a **Close position** button → `POST /api/trades/{id}/manual-close`. The mock bot closes the position at market on its next poll. For live trading, MT5 can also be used directly.

---

## 6.7 Theming

- `ThemeProvider`: `attribute="class"`, `defaultTheme="dark"`, `enableSystem`, `disableTransitionOnChange`.
- `globals.css` defines an **OKLCH** palette: light/dark tokens, mapped via `@theme inline`. Trading‑specific tokens: `--profit`, `--loss`, `--gold`, `--surface`, `--shell`.
- Components use semantic tokens (`bg-card`, `text-foreground`, `border-border`, …); theme‑sensitive accents carry explicit `dark:` variants.

---

## 6.8 Key TypeScript types (`src/types/index.ts`)

| Type | Purpose |
|------|---------|
| `BotState`, `TradeDirection`, `TradeStatus`, `LogLevel`, `BotMode` | String unions mirroring DB enums |
| `DashboardStats` | Heartbeat-derived stats (status, equity, balance, dailyPnl, drawdownPct, openTrades, lastPing, errorMsg, botMode?) |
| `TradeRow` | Trade as rendered in tables (id, symbol, direction, prices, lotSize, status, times, closePrice?, pnl?, manualClose?) |
| `RiskConfig`, `StrategyConfigData`, `BotConfigData` | Config panel shapes |

Chart helpers: `EquityPoint`, `OutcomeSlice`, `CHART_COLORS` in `src/lib/charts/trade-stats.ts`.

NextAuth augmentation: `src/types/next-auth.d.ts` extends `Session.user` with `role`, `permissions[]`, `passwordChangeRequired`.

---

Next: [07 — Data Model](./07-data-model.md)
