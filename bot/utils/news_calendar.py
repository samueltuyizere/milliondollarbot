"""
Forex Factory news calendar fetcher.

Fetches the current week's economic events from the public Forex Factory
JSON feed, filters by impact (HIGH/MEDIUM) and relevant currencies, then
upserts them into the news_events table so the risk guard can read them.

Run this once at bot startup and once per hour to keep the calendar fresh.
"""
import os
import json
import logging
import requests
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Currencies we care about (XAUUSD is USD-denominated)
RELEVANT_CURRENCIES = {"USD", "EUR", "GBP", "ALL"}

# Only block on these impact levels
BLOCK_IMPACTS = {"High"}

# Minutes to block before and after each high-impact event
MINUTES_BEFORE = 30
MINUTES_AFTER  = 30

FF_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json"

_session = requests.Session()
_session.headers.update({
    "User-Agent": "Mozilla/5.0 (AITrader bot; +https://github.com/hubertit/milliondollarbot)"
})


def fetch_ff_events() -> List[Dict[str, Any]]:
    """Fetch raw events from Forex Factory for the current week."""
    try:
        resp = _session.get(FF_URL, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        logger.warning(f"[news_calendar] FF fetch failed: {exc}")
        return []


def _parse_event_time(date_str: str) -> datetime | None:
    """
    FF dates look like '06-10-2026' and times like '8:30am'.
    Combined: '06-10-2026 8:30am'. Returns UTC-aware datetime.
    """
    try:
        dt = datetime.strptime(date_str, "%m-%d-%Y %I:%M%p")
        # FF calendar times are US/Eastern; convert to UTC (ET = UTC-4 in summer, UTC-5 in winter)
        # Use a simple heuristic: EDT (UTC-4) Apr–Oct, EST (UTC-5) Nov–Mar
        month = dt.month
        offset = timedelta(hours=4 if 4 <= month <= 10 else 5)
        return (dt + offset).replace(tzinfo=timezone.utc)
    except Exception:
        return None


def upsert_events(db_url: str) -> int:
    """
    Fetch FF events for the week, filter relevant ones, upsert into DB.
    Returns number of events upserted.
    """
    raw = fetch_ff_events()
    if not raw:
        return 0

    conn = psycopg2.connect(db_url, cursor_factory=psycopg2.extras.RealDictCursor)
    count = 0
    try:
        with conn:
            with conn.cursor() as cur:
                for ev in raw:
                    currency = ev.get("currency", "")
                    impact   = ev.get("impact", "")
                    title    = ev.get("title", "").strip()
                    date_str = ev.get("date", "")
                    time_str = ev.get("time", "")

                    # Skip irrelevant currencies or low-impact
                    if currency not in RELEVANT_CURRENCIES:
                        continue
                    if impact not in BLOCK_IMPACTS:
                        continue
                    if not date_str or not time_str or time_str.lower() in ("", "all day", "tentative"):
                        continue

                    event_time = _parse_event_time(f"{date_str} {time_str}")
                    if event_time is None:
                        continue

                    # Only care about events within the next 7 days
                    now = datetime.now(timezone.utc)
                    if event_time < now - timedelta(hours=1) or event_time > now + timedelta(days=7):
                        continue

                    skip_trading = impact == "High"
                    db_impact    = impact.upper()  # HIGH / MEDIUM / LOW

                    cur.execute("""
                        INSERT INTO news_events
                            (id, title, currency, impact, event_time, skip_trading,
                             minutes_before, minutes_after, created_at)
                        VALUES (
                            gen_random_uuid(), %s, %s, %s::\"NewsImpact\", %s, %s, %s, %s, NOW()
                        )
                        ON CONFLICT DO NOTHING
                    """, (
                        title, currency, db_impact, event_time,
                        skip_trading, MINUTES_BEFORE, MINUTES_AFTER,
                    ))
                    count += cur.rowcount
    finally:
        conn.close()

    logger.info(f"[news_calendar] Upserted {count} new events.")
    return count


def sync(db_url: str | None = None) -> int:
    """Public entry point — call this from mock_bot.py at startup and hourly."""
    url = db_url or os.environ.get("DATABASE_URL", "")
    if not url:
        logger.error("[news_calendar] DATABASE_URL not set, skipping sync.")
        return 0
    return upsert_events(url)
