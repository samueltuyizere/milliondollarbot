import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Bot status ───────────────────────────────────────────────────────────────

type BotState = "RUNNING" | "PAUSED" | "STOPPED" | "ERROR" | "DAILY_LOCK";

const botStateConfig: Record<BotState, { label: string; dot: string; badge: string }> = {
  RUNNING:    { label: "Running",    dot: "bg-[--profit] dot-blink", badge: "text-[--profit] bg-[--profit]/10 border-[--profit]/20" },
  PAUSED:     { label: "Paused",     dot: "bg-amber-400", badge: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
  STOPPED:    { label: "Stopped",    dot: "bg-muted-foreground", badge: "text-muted-foreground bg-muted border-border" },
  ERROR:      { label: "Error",      dot: "bg-[--loss] dot-blink", badge: "text-[--loss] bg-[--loss]/10 border-[--loss]/20" },
  DAILY_LOCK: { label: "Daily Lock", dot: "bg-[--loss] dot-blink", badge: "text-[--loss] bg-[--loss]/10 border-[--loss]/20" },
};

export function BotStatusBadge({ status }: { status: BotState }) {
  const cfg = botStateConfig[status] ?? botStateConfig.STOPPED;
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
      cfg.badge
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

// ─── Trade status ─────────────────────────────────────────────────────────────

type TradeStatus = "OPEN" | "CLOSED_WIN" | "CLOSED_LOSS" | "CLOSED_BE" | "PENDING" | "CANCELLED";

const tradeStateConfig: Record<TradeStatus, { label: string; style: string }> = {
  OPEN:        { label: "Open",       style: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
  CLOSED_WIN:  { label: "Win",        style: "text-[--profit] bg-[--profit]/10 border-[--profit]/20" },
  CLOSED_LOSS: { label: "Loss",       style: "text-[--loss] bg-[--loss]/10 border-[--loss]/20" },
  CLOSED_BE:   { label: "Break Even", style: "text-muted-foreground bg-muted border-border" },
  PENDING:     { label: "Pending",    style: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
  CANCELLED:   { label: "Cancelled",  style: "text-muted-foreground bg-muted border-border" },
};

export function TradeStatusBadge({ status }: { status: TradeStatus }) {
  const cfg = tradeStateConfig[status] ?? tradeStateConfig.PENDING;
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap",
      cfg.style
    )}>
      {cfg.label}
    </span>
  );
}

// ─── Direction badge ──────────────────────────────────────────────────────────

export function DirectionBadge({ direction }: { direction: "BUY" | "SELL" }) {
  const isBuy = direction === "BUY";
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-bold",
      isBuy
        ? "text-[--profit] bg-[--profit]/10 border-[--profit]/25"
        : "text-[--loss]   bg-[--loss]/10   border-[--loss]/25"
    )}>
      {isBuy
        ? <TrendingUp  className="w-3 h-3 shrink-0" />
        : <TrendingDown className="w-3 h-3 shrink-0" />}
      {direction}
    </span>
  );
}

// ─── Log level badge ──────────────────────────────────────────────────────────

type LogLevel = "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";

const logLevelConfig: Record<LogLevel, { label: string; style: string }> = {
  DEBUG:    { label: "DBG",  style: "text-muted-foreground" },
  INFO:     { label: "INFO", style: "text-blue-400" },
  WARNING:  { label: "WARN", style: "text-amber-400" },
  ERROR:    { label: "ERR",  style: "text-[--loss]" },
  CRITICAL: { label: "CRIT", style: "text-[--loss] font-bold" },
};

export function LogLevelBadge({ level }: { level: LogLevel }) {
  const cfg = logLevelConfig[level] ?? logLevelConfig.INFO;
  return (
    <span className={cn("font-mono text-[10px] uppercase tracking-widest tabular w-8 shrink-0", cfg.style)}>
      {cfg.label}
    </span>
  );
}
