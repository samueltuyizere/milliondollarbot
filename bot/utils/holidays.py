"""
Bank holiday fetcher using the free Nager.Date public API.

Fetches US and UK public holidays for the current year and upserts them
into the bank_holidays table. The risk guard reads from that table to
block all trading on holiday days.

Run once at bot startup (cached for the year — holidays don't change).
"""
import os
import logging
import requests
from datetime import datetime, timezone, date
from typing import List, Dict, Any

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Countries whose holidays mean markets are closed / liquidity is low
COUNTRIES = ["US", "GB"]  # ISO 3166-1 alpha-2

NAGER_URL = "https://date.nager.at/api/v3/PublicHolidays/{year}/{country}"

_session = requests.Session()
_session.headers.update({
    "User-Agent": "AITrader-bot/1.0"
})


def fetch_holidays(country: str, year: int) -> List[Dict[str, Any]]:
    """Fetch holidays for a given country and year from Nager.Date."""
    url = NAGER_URL.format(year=year, country=country)
    try:
        resp = _session.get(url, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        logger.warning(f"[holidays] Nager fetch failed for {country}/{year}: {exc}")
        return []


def upsert_holidays(db_url: str) -> int:
    """Fetch US + UK holidays for current (and next) year and upsert into DB."""
    today     = date.today()
    years     = {today.year, today.year + 1}
    all_items = []

    for country in COUNTRIES:
        for year in years:
            items = fetch_holidays(country, year)
            for item in items:
                all_items.append({
                    "country":  country,
                    "name":     item.get("localName") or item.get("name", "Holiday"),
                    "date":     item.get("date", ""),        # "2026-07-04"
                    "description": item.get("name", ""),
                })

    if not all_items:
        return 0

    conn  = psycopg2.connect(db_url, cursor_factory=psycopg2.extras.RealDictCursor)
    count = 0
    try:
        with conn:
            with conn.cursor() as cur:
                for h in all_items:
                    try:
                        holiday_date = datetime.strptime(h["date"], "%Y-%m-%d").replace(tzinfo=timezone.utc)
                    except ValueError:
                        continue

                    cur.execute("""
                        INSERT INTO bank_holidays (id, country, name, date, description, created_at)
                        VALUES (gen_random_uuid(), %s, %s, %s, %s, NOW())
                        ON CONFLICT DO NOTHING
                    """, (h["country"], h["name"], holiday_date, h["description"]))
                    count += cur.rowcount
    finally:
        conn.close()

    logger.info(f"[holidays] Upserted {count} holiday records.")
    return count


def sync(db_url: str | None = None) -> int:
    """Public entry point — call once at bot startup."""
    url = db_url or os.environ.get("DATABASE_URL", "")
    if not url:
        logger.error("[holidays] DATABASE_URL not set, skipping sync.")
        return 0
    return upsert_holidays(url)
