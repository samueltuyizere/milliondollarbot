"""
Reads all bot configuration from the local PostgreSQL database.
The dashboard writes config; the bot reads it. Never hardcode trading params here.
"""
import os
import json
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

DB_URL = os.environ["DATABASE_URL"]


def get_connection():
    return psycopg2.connect(DB_URL, cursor_factory=psycopg2.extras.RealDictCursor)


def load_bot_config() -> dict:
    """Returns merged config: bot_config + strategy + risk rules for the active account."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    bc.id AS bot_config_id,
                    bc.symbol,
                    bc.is_running,
                    bc.is_paused,
                    bc.long_only,
                    bc.session_start,
                    bc.session_end,
                    a.id AS account_id,
                    a.balance,
                    a.drawdown_limit,
                    a.daily_loss_limit,
                    sc.ema_fast,
                    sc.ema_slow,
                    sc.rsi_period,
                    sc.rsi_oversold,
                    sc.atr_period,
                    sc.atr_multi_sl,
                    sc.timeframe,
                    rr.risk_per_trade_pct,
                    rr.max_daily_loss_pct,
                    rr.max_drawdown_pct,
                    rr.min_rr,
                    rr.max_open_trades,
                    rr.daily_lock_active
                FROM bot_configs bc
                JOIN accounts a ON bc.account_id = a.id
                LEFT JOIN strategy_configs sc ON sc.bot_config_id = bc.id
                LEFT JOIN risk_rules rr ON rr.bot_config_id = bc.id
                WHERE a.is_active = TRUE
                LIMIT 1
            """)
            row = cur.fetchone()
            if not row:
                raise RuntimeError("No active bot config found. Set up an account in the dashboard first.")
            return dict(row)


def load_news_events() -> list:
    """Returns upcoming news events where skip_trading=True, within the next 24h."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT title, currency, impact, event_time, skip_trading, minutes_before, minutes_after
                FROM news_events
                WHERE skip_trading = TRUE
                  AND event_time BETWEEN NOW() - INTERVAL '12 hours' AND NOW() + INTERVAL '24 hours'
                ORDER BY event_time ASC
            """)
            return [dict(r) for r in cur.fetchall()]


def load_bank_holidays() -> list:
    """Returns bank holidays for today."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT country, name, date
                FROM bank_holidays
                WHERE DATE(date) = CURRENT_DATE
            """)
            return [dict(r) for r in cur.fetchall()]


def get_bot_command() -> str:
    """Reads the current command from bot_status (set by dashboard API)."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT status FROM bot_status ORDER BY updated_at DESC LIMIT 1")
            row = cur.fetchone()
            return row["status"] if row else "STOPPED"
