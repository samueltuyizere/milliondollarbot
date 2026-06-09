"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TradeStatusBadge } from "@/components/ui/status-badge";
import { TrendingUp, TrendingDown, X, Clock, Target, ShieldAlert, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TradeRow } from "@/types";

const CONTRACT_SIZE: Record<string, number> = { XAUUSD: 100 };

function floatingPnl(trade: TradeRow, price: number): number {
  const contract = CONTRACT_SIZE[trade.symbol] ?? 100;
  const diff = trade.direction === "SELL"
    ? trade.entryPrice - price
    : price - trade.entryPrice;
  return diff * trade.lotSize * contract;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function Row({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon && <span className="opacity-60">{icon}</span>}
        {label}
      </span>
      <span className="text-sm text-right">{value}</span>
    </div>
  );
}

interface TradeDetailModalProps {
  trade: TradeRow | null;
  refPrice?: number | null;
  closingId?: string | null;
  onClose: () => void;
  onRequestClose?: (trade: TradeRow) => void;
}

export function TradeDetailModal({
  trade,
  refPrice,
  closingId,
  onClose,
  onRequestClose,
}: TradeDetailModalProps) {
  if (!trade) return null;

  const isOpen = trade.status === "OPEN";
  const live = isOpen && refPrice != null ? floatingPnl(trade, refPrice) : null;
  const displayPnl = live ?? trade.pnl;
  const pnlPositive = (displayPnl ?? 0) >= 0;

  const rr =
    trade.entryPrice && trade.stopLoss && trade.takeProfit
      ? Math.abs(trade.takeProfit - trade.entryPrice) /
        Math.abs(trade.entryPrice - trade.stopLoss)
      : null;

  return (
    <Dialog open={!!trade} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex items-center justify-center w-10 h-10 rounded-xl shrink-0",
                trade.direction === "BUY"
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-red-500/10 text-red-400"
              )}
            >
              {trade.direction === "BUY" ? (
                <TrendingUp className="w-5 h-5" />
              ) : (
                <TrendingDown className="w-5 h-5" />
              )}
            </div>
            <div>
              <DialogTitle className="text-base">
                {trade.symbol} · {trade.direction}
              </DialogTitle>
              <div className="mt-0.5">
                <TradeStatusBadge status={trade.status} />
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* P&L hero */}
        <div
          className={cn(
            "rounded-xl border px-4 py-4 text-center",
            isOpen
              ? "bg-muted/20 border-border"
              : pnlPositive
              ? "bg-emerald-500/5 border-emerald-500/20"
              : "bg-red-500/5 border-red-500/20"
          )}
        >
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
            {isOpen ? (live != null ? "Floating P&L" : "Open position") : "Realized P&L"}
          </p>
          <p
            className={cn(
              "text-3xl font-bold tabular",
              displayPnl == null
                ? "text-muted-foreground"
                : pnlPositive
                ? "text-emerald-400"
                : "text-red-400"
            )}
          >
            {displayPnl != null
              ? `${pnlPositive ? "+" : "−"}$${Math.abs(displayPnl).toFixed(2)}`
              : "—"}
          </p>
          {isOpen && live != null && refPrice != null && (
            <p className="text-[11px] text-muted-foreground mt-1 tabular">
              vs market <span className="font-mono">{refPrice.toFixed(2)}</span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 ml-1.5 animate-pulse align-middle" />
            </p>
          )}
        </div>

        {/* Details grid */}
        <div className="rounded-xl border border-border bg-muted/10 divide-y divide-border overflow-hidden text-sm">
          <Row
            icon={<Layers className="w-3.5 h-3.5" />}
            label="Lot size"
            value={<span className="font-mono">{trade.lotSize}</span>}
          />
          <Row
            icon={<Clock className="w-3.5 h-3.5" />}
            label="Entry price"
            value={<span className="font-mono tabular">{trade.entryPrice.toFixed(2)}</span>}
          />
          {trade.closePrice != null && (
            <Row
              icon={<Clock className="w-3.5 h-3.5" />}
              label="Close price"
              value={<span className="font-mono tabular">{trade.closePrice.toFixed(2)}</span>}
            />
          )}
          <Row
            icon={<ShieldAlert className="w-3.5 h-3.5 text-red-400" />}
            label="Stop loss"
            value={
              <span className="font-mono tabular text-red-400">
                {trade.stopLoss.toFixed(2)}
              </span>
            }
          />
          <Row
            icon={<Target className="w-3.5 h-3.5 text-emerald-400" />}
            label="Take profit"
            value={
              <span className="font-mono tabular text-emerald-400">
                {trade.takeProfit.toFixed(2)}
              </span>
            }
          />
          {rr != null && (
            <Row
              label="Risk : Reward"
              value={<span className="font-mono">1 : {rr.toFixed(2)}</span>}
            />
          )}
          <Row
            icon={<Clock className="w-3.5 h-3.5" />}
            label="Opened"
            value={
              <span className="text-xs text-muted-foreground">
                {fmtDate(trade.openTime)}
              </span>
            }
          />
          {trade.closeTime && (
            <Row
              icon={<Clock className="w-3.5 h-3.5" />}
              label="Closed"
              value={
                <span className="text-xs text-muted-foreground">
                  {fmtDate(trade.closeTime)}
                </span>
              }
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {isOpen && onRequestClose && (
            trade.manualClose ? (
              <span className="text-xs text-muted-foreground italic">Closing…</span>
            ) : (
              <Button
                variant="destructive"
                disabled={closingId === trade.id}
                onClick={() => {
                  onClose();
                  onRequestClose(trade);
                }}
                className="gap-1.5"
              >
                <X className="w-4 h-4" />
                Close position
              </Button>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
