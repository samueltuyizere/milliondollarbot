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

## 6.2 Authentication & access control

### Configuration — `src/lib/auth.ts`
- **Credentials provider** only. `authorize()` looks up the `User` by email and verifies the password with `bcrypt.compare` against `passwordHash`.
- **JWT sessions** (no DB session store). The `jwt` callback copies `id` and `role` onto the token; the `session` callback exposes them on `session.user`.
- Custom sign‑in page: `/login`. Exports `handlers`, `auth`, `signIn`, `signOut`.
- Route handler: `src/app/api/auth/[...nextauth]/route.ts` re‑exports `GET`/`POST`.

### Route protection — `src/proxy.ts`
```
if path is /api/auth/* or a bot API → allow (public)
if path is /login → redirect to /dashboard when already logged in
if not logged in → redirect to /login
else → allow
```
**Public (no session) routes:** `/api/bot/heartbeat`, `/api/trades` (entire subtree), `/api/logs/system`. These exist so the bot can post without a session.

### Roles
- `User.role` is `ADMIN` or `TRADER`. The seeded user is `ADMIN`.
- ⚠️ Roles are **cosmetic** — the UI shows "Administrator"/"Trader", but **no route enforces RBAC**; any authenticated user has full access. (Tracked in [Known Issues](./10-known-issues-and-roadmap.md).)

### Seeded login
`admin@aitrader.local` / `admin1234` (created by `prisma/seed.ts`, bcrypt cost 12), along with the Phase‑1 account, bot config, strategy, risk rules, and an initial STOPPED `BotStatus`.

---

## 6.3 Pages

| Route | File | Rendering | Purpose |
|-------|------|-----------|---------|
| `/` | `app/page.tsx` | Server | Redirects to `/dashboard` |
| `/login` | `app/login/page.tsx` | Client | Credentials form + animated XAUUSD hero (outside the app shell) |
| `/dashboard` | `app/(dashboard)/dashboard/page.tsx` | Client | KPI cards, equity area chart, outcome donut, drawdown bar, recent trades with **live floating P&L** + manual‑close dialog. Polls every 5 s; price every 4 s |
| `/trades` | `app/(dashboard)/trades/page.tsx` | Client | Full trade history: summary pills, All/Open/Closed filter, pagination (20/page), manual close |
| `/calendar` | `app/(dashboard)/calendar/page.tsx` | Client | Tabs: News Events (CRUD) + Bank Holidays (CRUD) |
| `/logs` | `app/(dashboard)/logs/page.tsx` | Client | Tabs: System (level filter), Trade, Audit logs |
| `/bot` | `app/(dashboard)/bot/page.tsx` | Server | Redirect → `/dashboard?panel=bot` (opens the modal) |
| `/config` | `app/(dashboard)/config/page.tsx` | Server | Redirect → `/dashboard?panel=config` (opens the modal) |

All `(dashboard)` pages are wrapped by `app/(dashboard)/layout.tsx` → `AppShell`.

---

## 6.4 Layout & component architecture

### Shell (`src/components/layout/`)
| Component | Responsibility |
|-----------|----------------|
| `AppShell` | Hosts `ModalProvider`, sidebar, header, main content, `PanelUrlSync`, `AppModals`. Persists sidebar‑collapsed in `localStorage` (`aitrader_sidebar_collapsed`) |
| `Sidebar` | Route nav (Dashboard, Trades, Calendar, Logs) + **modal triggers** (Bot Control, Configuration); user avatar/role; collapsible |
| `Header` | Page title, `PriceTicker`, `ThemeToggle`, `BotStatusPill` (with `BotModeBadge`), user dropdown (sign out) |
| `PriceTicker` | Polls `/api/market/price` every 15 s; shows spot price + day‑change %, flashes on change |
| `ThemeToggle` | Light/dark switch via `next-themes` (mount‑guarded to avoid hydration mismatch) |
| `AppModals` | Renders the Bot Control and Configuration dialogs |
| `PanelUrlSync` | Reads `?panel=bot|config`, opens the corresponding modal, then cleans the URL |

### Modal system
- `src/context/modal-context.tsx` — `ModalProvider` + `useModals()`, state `modal: "bot" | "config" | null`.
- Sidebar/header items and the `?panel=` query all funnel into the same provider, so Bot Control and Configuration open as **modals** rather than full pages.

### Feature panels
| Component | Responsibility |
|-----------|----------------|
| `bot/bot-control-panel.tsx` | Polls `/api/bot/status` (every 3 s while open); Start/Pause/Stop/Resume → `POST /api/bot/control`; KPI + heartbeat display |
| `config/config-panel.tsx` | Tabs: Risk (`/api/config/risk`), Strategy (`/api/config/strategy`), Bot settings (`/api/config/bot`); saves via PUT |

### Charts (`src/components/charts/`, data in `src/lib/charts/trade-stats.ts`)
| Component | Shows |
|-----------|-------|
| `EquityAreaChart` | Cumulative equity curve (`buildEquitySeries`) |
| `TradeOutcomeDonut` | Win/loss/BE/open breakdown with win‑rate center (`buildOutcomeBreakdown`, `calcWinRate`) |
| `ChartPanel` | Shared card wrapper + empty‑state |

### UI primitives (`src/components/ui/`)
`alert-banner`, `bot-mode-badge`, `status-badge`, `stat-card`, `section-header`, `field-row`, `empty-state`, `dialog`, plus shadcn primitives (`button`, `input`, `switch`, `tabs`, `table`, `select`, `textarea`, …) and `sonner` toasts.

---

## 6.5 API routes (complete)

**Legend:** 🔓 Public (bot, no session) · 🔒 Protected (session required).

### Auth
| Method | Route | | Purpose |
|--------|-------|---|---------|
| GET/POST | `/api/auth/[...nextauth]` | 🔓 | Auth.js session endpoints |

### Bot
| Method | Route | | Request → Response |
|--------|-------|---|--------------------|
| GET | `/api/bot/status` | 🔒 | → `{ status: BotStatus | defaults }` |
| POST | `/api/bot/heartbeat` | 🔓 | `{ status?, equity?, balance?, dailyPnl?, peakEquity?, drawdownPct?, openTrades?, errorMsg?, botMode? }` → `{ ok: true }`; upserts latest `BotStatus` |
| POST | `/api/bot/control` | 🔒 | `{ command: "start"|"stop"|"pause"|"resume" }` → `{ ok, status }`; blocks non‑start while `DAILY_LOCK`; writes audit + system log |

### Trades
| Method | Route | | Request → Response |
|--------|-------|---|--------------------|
| GET | `/api/trades` | 🔓 | `?limit=50&status=OPEN` → `{ trades: Trade[] }` |
| POST | `/api/trades` | 🔓 | `{ accountId, direction, entryPrice, stopLoss, takeProfit, lotSize, symbol?, mt5Ticket? }` → `{ ok, trade }`; creates `trade_logs` "OPENED" |
| POST | `/api/trades/[id]/close` | 🔓 | `{ closePrice, pnl?, commission?, swap? }` → `{ ok, trade }`; status set from P&L (WIN/LOSS/BE) |
| POST | `/api/trades/[id]/manual-close` | 🔒 | → `{ ok }`; sets `manualClose: true` for the bot to honour |

### Config
| Method | Route | | Fields |
|--------|-------|---|--------|
| GET/PUT | `/api/config/bot` | 🔒 | `longOnly, sessionStart, sessionEnd` (audit `config.bot.update`) |
| GET/PUT | `/api/config/risk` | 🔒 | `riskPerTradePct, maxDailyLossPct, maxDrawdownPct, minRR, maxOpenTrades` (audit `config.risk.update`) |
| GET/PUT | `/api/config/strategy` | 🔒 | `emaFast, emaSlow, rsiPeriod, rsiOversold, atrPeriod, atrMultiSl` (audit `config.strategy.update`; `timeframe` not updatable) |

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
| GET | `/api/market/price` | 🔒 | `{ symbol, price, refPrice, previousClose, change, changePct, currency, marketState, fetchedAt }` (+ optional `stale`) |

**Price route detail:** `price` is **spot** gold from `api.gold-api.com/price/XAU` (matches TradingView); `refPrice` is the **futures** `GC=F` price from Yahoo (used to value open positions, since the bot trades futures); `changePct` is Yahoo's day‑change (basis cancels in % terms). Results are cached in‑memory for 15 s, with stale‑fallback and a Yahoo‑only fallback if the spot source is down.

---

## 6.6 Live floating P&L & manual close

On `/dashboard` and `/trades`:
- The page polls `/api/market/price` every 4 s and computes **floating P&L** for each open trade using `(refPrice − entry) × lot × 100` (negated for SELL) — i.e. the same formula and the same **futures** price the bot uses, so there's no spot‑vs‑futures basis distortion.
- Open rows show a pulsing "live" dot; the section header shows a combined floating total.
- The **Close** button opens a custom themed confirmation dialog (symbol, direction, lot, entry, market price, floating P&L) → `POST /api/trades/{id}/manual-close`. The mock bot then closes the position at market on its next poll.

---

## 6.7 Theming

- `ThemeProvider` (in `src/components/providers.tsx`): `attribute="class"`, `defaultTheme="dark"`, `enableSystem`, `disableTransitionOnChange`.
- `globals.css` defines an **OKLCH** palette: light tokens under `:root`, dark tokens under `.dark`, mapped to Tailwind tokens via `@theme inline`. Trading‑specific tokens: `--profit`, `--loss`, `--gold`, `--surface`, `--shell`.
- The toggle lives in the header. Components use semantic tokens (`bg-card`, `text-foreground`, `border-border`, …) so they adapt automatically; theme‑sensitive accents (amber/emerald badges, alert banners) carry explicit `dark:` variants for contrast in both modes.

---

## 6.8 Key TypeScript types (`src/types/index.ts`)

| Type | Purpose |
|------|---------|
| `BotState`, `TradeDirection`, `TradeStatus`, `LogLevel`, `BotMode` | String unions mirroring DB enums (+ `BotMode = "mock" | "live"`) |
| `DashboardStats` | Heartbeat‑derived stats for the dashboard (status, equity, balance, dailyPnl, drawdownPct, openTrades, lastPing, errorMsg, botMode?) |
| `TradeRow` | Trade as rendered in tables (id, symbol, direction, prices, lotSize, status, times, pnl?, manualClose?) |
| `RiskConfig`, `StrategyConfigData`, `BotConfigData` | Shapes for the config panels |

Chart helpers add `EquityPoint`, `OutcomeSlice`, and `CHART_COLORS` in `src/lib/charts/trade-stats.ts`.

---

Next: [07 — Data Model](./07-data-model.md)
