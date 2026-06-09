"""
Risk Guard — the gatekeeper between strategy signals and order execution.

The bot NEVER places a trade unless this module returns True from all checks.
Order of checks (fastest-fail first):
  1. Daily lock flag
  2. Daily P&L vs max_daily_loss_pct
  3. Drawdown vs max_drawdown_pct
  4. Max open trades
  5. R:R ratio validation
  6. News / bank holiday filter

If ANY check fails, the trade is rejected and the reason is logged.
"""
from datetime import datetime, timezone
from typing import Tuple, Optional
import psycopg2
import psycopg2.extras
from config import get_connection
from utils.logger import log


class RiskGuard:
    def __init__(self, cfg: dict):
        self.cfg = cfg
        self.account_id = cfg["account_id"]
        self.balance = cfg["balance"]

    # ─── Public gate ──────────────────────────────────────────────────────────

    def check_all(
        self,
        entry: float,
        sl: float,
        tp: float,
        direction: str,
        open_trades_count: int,
        equity: float,
        floating_pnl: float = 0.0,
    ) -> Tuple[bool, str]:
        """
        Returns (allowed: bool, reason: str).
        reason is empty string if allowed.
        floating_pnl: unrealized P&L of currently open positions.
        """
        checks = [
            self._check_daily_lock,
            lambda: self._check_daily_loss(equity, floating_pnl),
            lambda: self._check_drawdown(equity),
            lambda: self._check_max_open_trades(open_trades_count),
            lambda: self._check_rr(entry, sl, tp, direction),
            self._check_session,
            self._check_news,
            self._check_bank_holiday,
        ]

        for check in checks:
            ok, reason = check()
            if not ok:
                log("WARNING", "risk", f"Trade BLOCKED: {reason}")
                return False, reason

        return True, ""

    # ─── Individual checks ────────────────────────────────────────────────────

    def _check_daily_lock(self) -> Tuple[bool, str]:
        if self.cfg.get("daily_lock_active"):
            return False, "Daily loss lock is active"
        return True, ""

    def _check_daily_loss(self, equity: float, floating_pnl: float = 0.0) -> Tuple[bool, str]:
        max_loss_usd = self.balance * (self.cfg["max_daily_loss_pct"] / 100)
        realized_pnl = self._get_today_pnl()
        total_daily_pnl = realized_pnl + floating_pnl
        if total_daily_pnl <= -max_loss_usd:
            self._activate_daily_lock()
            return False, f"Daily loss limit hit: ${total_daily_pnl:.2f} (realized ${realized_pnl:.2f} + floating ${floating_pnl:.2f}) / limit -${max_loss_usd:.2f}"
        return True, ""

    def _check_drawdown(self, equity: float) -> Tuple[bool, str]:
        peak = self._get_peak_equity()
        if peak and peak > 0:
            dd_pct = ((peak - equity) / peak) * 100
            if dd_pct >= self.cfg["max_drawdown_pct"]:
                return False, f"Drawdown limit hit: {dd_pct:.2f}% >= {self.cfg['max_drawdown_pct']}%"
        return True, ""

    def _check_max_open_trades(self, count: int) -> Tuple[bool, str]:
        if count >= self.cfg["max_open_trades"]:
            return False, f"Max open trades reached: {count}"
        return True, ""

    def _check_rr(self, entry: float, sl: float, tp: float, direction: str) -> Tuple[bool, str]:
        if direction == "BUY":
            risk = entry - sl
            reward = tp - entry
        else:
            risk = sl - entry
            reward = entry - tp

        if risk <= 0:
            return False, "Invalid SL (risk <= 0)"
        rr = reward / risk
        if rr < self.cfg["min_rr"]:
            return False, f"R:R too low: {rr:.2f} < {self.cfg['min_rr']}"
        return True, ""

    def _check_session(self) -> Tuple[bool, str]:
        now_utc = datetime.now(timezone.utc).strftime("%H:%M")
        start = self.cfg.get("session_start", "08:00")
        end = self.cfg.get("session_end", "17:00")
        # start is inclusive, end is exclusive — no new entries AT or after end time
        if not (start <= now_utc < end):
            return False, f"Outside session window ({start}–{end} UTC)"
        return True, ""

    def _check_news(self) -> Tuple[bool, str]:
        from config import load_news_events
        now = datetime.now(timezone.utc)
        for event in load_news_events():
            if not event["skip_trading"]:
                continue
            event_time = event["event_time"]
            if event_time.tzinfo is None:
                event_time = event_time.replace(tzinfo=timezone.utc)
            delta_min = (now - event_time).total_seconds() / 60
            window_start = -event["minutes_before"]
            window_end = event["minutes_after"]
            if window_start <= delta_min <= window_end:
                return False, f"News blackout: {event['title']} ({event['impact']})"
        return True, ""

    def _check_bank_holiday(self) -> Tuple[bool, str]:
        from config import load_bank_holidays
        holidays = load_bank_holidays()
        if holidays:
            names = ", ".join(h["name"] for h in holidays)
            return False, f"Bank holiday: {names}"
        return True, ""

    # ─── DB helpers ───────────────────────────────────────────────────────────

    def _get_today_pnl(self) -> float:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT COALESCE(SUM(pnl), 0) AS today_pnl
                    FROM trades
                    WHERE account_id = %s
                      AND DATE(close_time) = CURRENT_DATE
                      AND status IN ('CLOSED_WIN', 'CLOSED_LOSS', 'CLOSED_BE')
                """, (self.account_id,))
                row = cur.fetchone()
                return float(row["today_pnl"])

    def _get_peak_equity(self) -> Optional[float]:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT peak_equity FROM bot_status ORDER BY updated_at DESC LIMIT 1")
                row = cur.fetchone()
                return float(row["peak_equity"]) if row and row["peak_equity"] else None

    def _activate_daily_lock(self):
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE bot_status SET status = 'DAILY_LOCK'
                    WHERE id = (SELECT id FROM bot_status ORDER BY updated_at DESC LIMIT 1)
                """)
                cur.execute("""
                    UPDATE risk_rules SET daily_lock_active = TRUE
                    WHERE bot_config_id = (
                        SELECT id FROM bot_configs
                        WHERE account_id = %s LIMIT 1
                    )
                """, (self.account_id,))
            conn.commit()
        log("CRITICAL", "risk", "Daily loss limit reached. Bot DAILY_LOCK activated.")
