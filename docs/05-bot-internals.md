# 05 — Bot Internals

> **Source:** the `bot/` directory. This document covers the Python process structure, the main loop, and the live vs. mock differences.

## 5.1 File map

| Path | Role |
|------|------|
| `bot/main.py` | **Live** entry point — MetaTrader 5 execution |
| `bot/mock_bot.py` | **Paper/mock** entry point — Yahoo data, no broker |
| `bot/config.py` | Reads config/command/news/holidays from PostgreSQL |
| `bot/strategy/ema_pullback.py` | H1 EMA pullback signal (see [03](./03-trading-strategy.md)) |
| `bot/risk/risk_guard.py` | Pre‑trade risk gate (see [04](./04-risk-management.md)) |
| `bot/utils/mt5_client.py` | MT5 connect / data / sizing / orders (live) |
| `bot/utils/market_data.py` | Yahoo `GC=F` OHLCV + price (mock) |
| `bot/utils/lot_sizing.py` | Offline lot/P&L math (mock) |
| `bot/utils/db_writer.py` | HTTP reporting to the dashboard |
| `bot/utils/logger.py` | Stdout + dashboard system‑log posting |
| `bot/requirements.txt` | Python dependencies |
| `bot/.env(.example)` | Environment configuration |

### Dependency graph

```
main.py ─┬─ config (load_bot_config, get_bot_command)
         ├─ strategy.ema_pullback (check_signal)
         ├─ risk.risk_guard (RiskGuard)
         ├─ utils.mt5_client (connect, get_account_info, get_ohlcv,
         │                    calculate_lot_size, place_order, get_open_positions)
         ├─ utils.db_writer (report_trade_opened/closed, send_heartbeat)
         └─ utils.logger (log)

mock_bot.py ─┬─ config, strategy.ema_pullback, risk.risk_guard
             ├─ utils.market_data (get_ohlcv, get_current_price)
             ├─ utils.lot_sizing (calculate_lot_size, calc_pnl)
             ├─ utils.db_writer (+ restore_session_state)
             ├─ utils.logger
             └─ stubs MetaTrader5 via unittest.mock  (so imports work off‑Windows)
```

`config.py` talks to PostgreSQL via `psycopg2`. `db_writer.py` and `logger.py` talk to the dashboard via `requests`.

---

## 5.2 The main loop (shared shape)

Both bots run the same loop shape. Each iteration:

```
load_bot_config()                     # hot-reload settings from DB
guard = RiskGuard(cfg)                # fresh guard each loop
cmd = get_bot_command()               # latest bot_status.status

if cmd == STOPPED:      heartbeat(STOPPED);   sleep(10);  continue
if cmd in (DAILY_LOCK, ERROR): heartbeat(cmd); sleep(30); continue
if cmd == PAUSED:       heartbeat(PAUSED);    sleep(10);  continue

# RUNNING:
price/account = fetch                 # MT5 account (live) or computed equity (mock)
update peak_equity
heartbeat(RUNNING) every HEARTBEAT_SECONDS
check/close exits                     # _check_closed_positions (live) / _check_paper_exits (mock)
if open_count >= max_open_trades: sleep(POLL); continue
df = OHLCV(200 bars)
signal = check_signal(df, cfg)
if not signal: sleep(POLL); continue
allowed, reason = guard.check_all(...)
if not allowed: log(reason); sleep(POLL); continue
lot = calculate_lot_size(...)
place_order(...) / _open_paper_trade(...)
report_trade_opened(...)
sleep(POLL_SECONDS)
```

Timing knobs (env): `POLL_SECONDS` (default 15), `HEARTBEAT_SECONDS` (default 10).

State held in‑process: `running` flag (cleared by SIGTERM/SIGINT for graceful shutdown), `peak_equity`, `today_pnl`, `last_heartbeat`, and the open‑trade tracking map.

---

## 5.3 Live bot — `main.py`

- Connects to MetaTrader 5 (`connect()` → `mt5.initialize()`); **assumes MT5 is already open and logged in** (it never calls `mt5.login()`).
- Tracks open trades in `open_trade_map: {mt5_ticket → dashboard_trade_id}`.
- `get_account_info()` provides real balance/equity/profit.
- `_update_open_trades()` sets `today_pnl = sum(position.profit)` — i.e. **floating** P&L of open positions.
- `_check_closed_positions()` compares tracked tickets against current MT5 positions; when a ticket disappears it reads the MT5 deal history (the OUT deal) to get the realized P&L and calls `report_trade_closed()`.
- Orders are market deals with `magic = 20240608`, `comment = "AITrader"`, `ORDER_FILLING_IOC`, retrying on requote/price‑changed/off‑quotes.
- Heartbeats omit `bot_mode`, so `db_writer` defaults it to `"live"`.

### ⚠️ Known live‑bot issues (details in [10](./10-known-issues-and-roadmap.md))

- **STOPPED branch** references `equity`/`balance` before they are defined and calls a non‑imported `open_positions(...)` → `NameError` if the process is running while the dashboard says STOPPED.
- **No manual‑close handling** — unlike the mock bot, the live bot does not act on `trades.manual_close`.
- **P&L semantics mismatch** — live `today_pnl` is floating, while the risk guard's daily‑loss check reads realized closed P&L from the DB.
- `_send_hb()` reports `open_trades = 0` for PAUSED/DAILY_LOCK/ERROR states.

---

## 5.4 Mock bot — `mock_bot.py`

Designed to run the **exact same strategy and risk code** on macOS/Linux with **no MT5**:

- At import, it stubs the MT5 module: `sys.modules["MetaTrader5"] = mock.MagicMock()` so any transitive import succeeds.
- Market data comes from `utils/market_data.py` (Yahoo `GC=F`).
- Lot sizing/P&L from `utils/lot_sizing.py`.
- Positions live in memory: `open_trades: {trade_id → {entry, sl, tp, direction, lot_size}}`.
- `BOT_MODE = "mock"` is sent in every heartbeat, which drives the dashboard's "Simulation" badge.

### Paper position lifecycle

| Step | Function | Behaviour |
|------|----------|-----------|
| Open | `_open_paper_trade()` | Assigns a synthetic ticket (≥ 900,000), POSTs `/api/trades`, stores the position locally |
| Exit (SL/TP) | `_check_paper_exits()` | Closes when live price / latest bar range touches SL or TP; computes P&L; POSTs `/close` |
| Exit (manual) | `_check_manual_close_requests()` | Polls `GET /api/trades?status=OPEN`; closes any with `manualClose: true` at current price |
| Session restore | `restore_session_state()` | On startup, derives `today_pnl`, `total_pnl`, `peak_equity` from closed trades so a restart doesn't lose history |
| Ticket sequence | `_init_ticket_seq()` | Reads existing tickets so synthetic tickets stay unique (≥ 900,000 namespace separates paper from real) |

Equity in mock mode is computed as `balance + today_pnl + floating_pnl(open positions)`.

### ⚠️ Known mock‑bot issues

- **Shutdown double‑counts** today's P&L: `final_equity = base_balance + state["total_pnl"] + today_pnl`, where `state["total_pnl"]` already includes today's closes.
- The process is sensitive to how it's backgrounded — when launched via a shell that later exits, the OS may reap it. Prefer a process manager or a persistent terminal. (During development it is run as a managed background process.)

---

## 5.5 Live vs. mock — side by side

| Aspect | `main.py` (live) | `mock_bot.py` (mock) |
|--------|------------------|----------------------|
| OS | Windows only | macOS / Linux / Windows |
| MetaTrader 5 | Real connection | Stubbed (`MagicMock`) |
| Market data | MT5 `copy_rates_from_pos` | Yahoo `GC=F` chart API |
| Lot sizing | `mt5_client.calculate_lot_size` (live ticks) | `lot_sizing.calculate_lot_size` (fixed specs) |
| Orders | Real MT5 market orders | In‑memory dict |
| Exits | MT5 SL/TP + close detection | `_check_paper_exits` price comparison |
| Manual close | ⚠️ not implemented | Polled and honoured |
| Balance | Live MT5 account | `cfg.balance` + restored closed P&L |
| Heartbeat `botMode` | `"live"` (default) | `"mock"` |
| Demo mode | n/a | Honours `DEMO_LOOSE=1` (via strategy) |

The shared `strategy/` and `risk/` modules guarantee the mock bot makes the **same decisions** the live bot would, given the same data.

---

## 5.6 Market data (`utils/market_data.py`)

- Maps `XAUUSD`/`GOLD` → Yahoo ticker **`GC=F`** (COMEX gold futures, a close XAUUSD proxy).
- `get_ohlcv()` fetches candles via `https://query1.finance.yahoo.com/v8/finance/chart/{ticker}`, maps timeframes (H1→`60m`), caches results for **45 s**, returns the last `bars` rows as a pandas DataFrame (`time, open, high, low, close, volume`).
- `get_current_price()` reads `regularMarketPrice` (fallback `previousClose`, then last H1 close).
- ⚠️ This is an **undocumented** endpoint; it can rate‑limit or hiccup. Failures fall back to cached data. (An earlier attempt to use the `yfinance` library was dropped due to rate limiting.)

---

## 5.7 Dashboard reporting (`utils/db_writer.py`, `utils/logger.py`)

| Function | Endpoint | Notes |
|----------|----------|-------|
| `report_trade_opened()` | `POST /api/trades` | Returns the created trade's `id` |
| `report_trade_closed()` | `POST /api/trades/{id}/close` | Sends closePrice, pnl, commission, swap |
| `restore_session_state()` | `GET /api/trades?limit=10000` | Recomputes session P&L on startup |
| `send_heartbeat()` | `POST /api/bot/heartbeat` | 3 s timeout; failures ignored; computes `drawdownPct` client‑side |
| `log()` | `POST /api/logs/system` | 2 s timeout; also prints to stdout/stderr |

Both writers tolerate the dashboard being briefly unavailable — short timeouts, silent failure — so a flaky dashboard never blocks trading.

---

## 5.8 Environment variables

| Variable | Required | Default | Used by |
|----------|----------|---------|---------|
| `DATABASE_URL` | **Yes** | — | `config.py` (direct PostgreSQL) |
| `DASHBOARD_URL` | No | `http://localhost:3000` | `db_writer.py`, `logger.py` |
| `DASHBOARD_API_URL` | No | `http://localhost:3000` | `mock_bot.py` ticket‑seq init |
| `POLL_SECONDS` | No | 15 | both bots (loop cadence) |
| `HEARTBEAT_SECONDS` | No | 10 | both bots (heartbeat cadence) |
| `DEMO_LOOSE` | No | unset | strategy (relaxes signals for demos) |
| `MT5_LOGIN` / `MT5_PASSWORD` / `MT5_SERVER` | No | in `.env.example` | ⚠️ present but **unused** (MT5 auth is via the open terminal) |

---

## 5.9 Dependencies (`requirements.txt`)

```
MetaTrader5==5.0.45      # live execution (Windows)
psycopg2-binary==2.9.9   # PostgreSQL access
requests==2.32.3         # dashboard HTTP + Yahoo data
python-dotenv==1.0.1     # .env loading
pandas==2.2.2            # OHLCV / indicators
numpy==1.26.4            # indicator math
ta==0.11.0               # (currently unused)
schedule==1.2.2          # (currently unused)
pytz==2024.1             # (currently unused)
```

---

Next: [06 — Dashboard](./06-dashboard.md)
