"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { RefreshCw, X, TrendingUp, TrendingDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeader } from "@/components/ui/section-header";
import { TradeStatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { TradeDetailModal } from "@/components/ui/trade-detail-modal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TradeRow } from "@/types";

type Filter = "ALL" | "OPEN" | "CLOSED";
const PAGE_SIZE = 20;

function fmt(iso: string) {
  return new Date(iso).toLocaleString([], {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: "ALL",    label: "All" },
  { id: "OPEN",   label: "Open" },
  { id: "CLOSED", label: "Closed" },
];

export default function TradesPage() {
  const [all, setAll]           = useState<TradeRow[]>([]);
  const [filter, setFilter]     = useState<Filter>("ALL");
  const [loading, setLoading]   = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closeTarget, setCloseTarget] = useState<TradeRow | null>(null);
  const [detailTrade, setDetailTrade] = useState<TradeRow | null>(null);
  const [page, setPage] = useState(1);

  const fetchTrades = useCallback(async () => {
    try {
      const r = await fetch("/api/trades?limit=500");
      const d = await r.json();
      setAll(d.trades ?? []);
      setLastRefresh(new Date());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTrades();
    const id = setInterval(fetchTrades, 5000);
    return () => clearInterval(id);
  }, [fetchTrades]);

  async function confirmManualClose() {
    if (!closeTarget) return;
    setClosingId(closeTarget.id);
    setCloseTarget(null);
    try {
      await fetch(`/api/trades/${closeTarget.id}/manual-close`, { method: "POST" });
      await fetchTrades();
    } finally {
      setClosingId(null);
    }
  }

  const filtered = useMemo(() => all.filter((t) => {
    if (filter === "OPEN")   return t.status === "OPEN";
    if (filter === "CLOSED") return t.status !== "OPEN";
    return true;
  }), [all, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const trades     = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const openCount   = all.filter((t) => t.status === "OPEN").length;
  const winCount    = all.filter((t) => t.status === "CLOSED_WIN").length;
  const lossCount   = all.filter((t) => t.status === "CLOSED_LOSS").length;
  const totalPnl    = all.reduce((s, t) => s + (t.pnl ?? 0), 0);

  return (
    <div className="space-y-5">
      {/* Summary pills */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-medium">
          {openCount} Open
        </span>
        <span className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">
          {winCount} Wins
        </span>
        <span className="px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 font-medium">
          {lossCount} Losses
        </span>
        <span className={cn(
          "px-3 py-1.5 rounded-full border font-medium",
          totalPnl >= 0
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
            : "bg-red-500/10 border-red-500/20 text-red-400"
        )}>
          Total P&L {totalPnl >= 0 ? "+" : ""}${Math.abs(totalPnl).toFixed(0)}
        </span>
      </div>

      {/* Table */}
      <div>
        <SectionHeader
          title="Trade History"
          description={`${trades.length} trade${trades.length !== 1 ? "s" : ""}${lastRefresh ? ` · ${lastRefresh.toLocaleTimeString()}` : ""}`}
        >
          {/* Filter tabs */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-0.5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => { setFilter(f.id); setPage(1); }}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                  filter === f.id
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f.label}
                {f.id === "OPEN" && openCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px]">
                    {openCount}
                  </span>
                )}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={fetchTrades} className="h-7 text-xs gap-1.5">
            <RefreshCw className="w-3 h-3" /> Refresh
          </Button>
        </SectionHeader>

        {loading ? (
          <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : trades.length === 0 ? (
          <div className="rounded-lg border border-border bg-card">
            <EmptyState
              icon={<TrendingUp className="w-5 h-5" />}
              title="No trades"
              description={filter === "OPEN" ? "No open positions." : "No trade history yet."}
            />
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-2.5 text-left   text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Opened</th>
                    <th className="px-4 py-2.5 text-left   text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground hidden sm:table-cell">Closed</th>
                    <th className="px-4 py-2.5 text-left   text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Symbol</th>
                    <th className="px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Dir</th>
                    <th className="px-4 py-2.5 text-right  text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Entry</th>
                    <th className="px-4 py-2.5 text-right  text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground hidden md:table-cell">SL</th>
                    <th className="px-4 py-2.5 text-right  text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground hidden md:table-cell">TP</th>
                    <th className="px-4 py-2.5 text-right  text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground hidden sm:table-cell">Close</th>
                    <th className="px-4 py-2.5 text-right  text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground hidden sm:table-cell">Lots</th>
                    <th className="px-4 py-2.5 text-right  text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">P&L</th>
                    <th className="px-4 py-2.5 text-right  text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Status</th>
                    <th className="px-4 py-2.5 text-right  text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {trades.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => setDetailTrade(t)}
                      className={cn(
                        "transition-colors cursor-pointer",
                        t.direction === "BUY"
                          ? "bg-emerald-500/[0.04] hover:bg-emerald-500/[0.09]"
                          : "bg-red-500/[0.04]     hover:bg-red-500/[0.09]"
                      )}
                    >
                      <td className="px-4 py-2.5 text-xs tabular whitespace-nowrap text-muted-foreground">
                        {fmt(t.openTime)}
                      </td>
                      <td className="px-4 py-2.5 text-xs tabular whitespace-nowrap text-muted-foreground hidden sm:table-cell">
                        {t.closeTime ? fmt(t.closeTime) : <span className="italic text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs font-medium">{t.symbol}</td>
                      <td className="px-4 py-2.5 text-center">
                        {t.direction === "BUY"
                          ? <TrendingUp   className="w-3.5 h-3.5 text-emerald-500 inline" />
                          : <TrendingDown className="w-3.5 h-3.5 text-red-500 inline" />}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs tabular">{t.entryPrice.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs tabular text-red-400 hidden md:table-cell">{t.stopLoss.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs tabular text-emerald-400 hidden md:table-cell">{t.takeProfit.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs tabular text-muted-foreground hidden sm:table-cell">
                        {t.closePrice != null ? t.closePrice.toFixed(2) : <span className="italic opacity-40">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs tabular text-muted-foreground hidden sm:table-cell">
                        {t.lotSize}
                      </td>
                      <td className={cn(
                        "px-4 py-2.5 text-right font-mono text-xs tabular font-medium",
                        t.pnl == null ? "text-muted-foreground"
                          : t.pnl > 0 ? "text-emerald-400"
                          : t.pnl < 0 ? "text-red-400"
                          : "text-muted-foreground"
                      )}>
                        {t.pnl != null
                          ? `${t.pnl >= 0 ? "+" : ""}$${Math.abs(t.pnl).toFixed(0)}`
                          : <span className="opacity-40">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <TradeStatusBadge status={t.status} />
                      </td>
                      <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                        {t.status === "OPEN" && (
                          t.manualClose ? (
                            <span className="text-[10px] text-muted-foreground italic">Closing…</span>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={closingId === t.id}
                              onClick={() => setCloseTarget(t)}
                              className="h-6 px-2 text-[10px] text-red-400 hover:text-red-400 hover:bg-red-400/10 gap-1"
                            >
                              <X className="w-3 h-3" /> Close
                            </Button>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 text-xs text-muted-foreground">
            <span>
              {((safePage - 1) * PAGE_SIZE) + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost" size="sm"
                disabled={safePage === 1}
                onClick={() => setPage((p) => p - 1)}
                className="h-7 w-7 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                .reduce<(number | "…")[]>((acc, p, i, arr) => {
                  if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push("…");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === "…" ? (
                    <span key={`ellipsis-${i}`} className="px-1">…</span>
                  ) : (
                    <Button
                      key={p}
                      variant="ghost" size="sm"
                      onClick={() => setPage(p as number)}
                      className={cn(
                        "h-7 w-7 p-0 text-xs",
                        safePage === p && "bg-muted text-foreground font-semibold"
                      )}
                    >
                      {p}
                    </Button>
                  )
                )}

              <Button
                variant="ghost" size="sm"
                disabled={safePage === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="h-7 w-7 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Trade detail modal */}
      <TradeDetailModal
        trade={detailTrade}
        closingId={closingId}
        onClose={() => setDetailTrade(null)}
        onRequestClose={(t) => setCloseTarget(t)}
      />

      {/* Close confirm dialog */}
      <Dialog open={closeTarget != null} onOpenChange={(o) => !o && setCloseTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-red-500/10 text-red-400">
                <X className="w-4 h-4" />
              </span>
              <div>
                <DialogTitle>Close position</DialogTitle>
                <DialogDescription>Close at the current market price.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {closeTarget && (
            <div className="rounded-lg border border-border bg-muted/30 divide-y divide-border text-sm">
              <div className="flex items-center justify-between px-3.5 py-2.5">
                <span className="text-xs text-muted-foreground">Symbol</span>
                <span className="font-mono">{closeTarget.symbol} · {closeTarget.direction}</span>
              </div>
              <div className="flex items-center justify-between px-3.5 py-2.5">
                <span className="text-xs text-muted-foreground">Entry</span>
                <span className="font-mono tabular">{closeTarget.entryPrice.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between px-3.5 py-2.5">
                <span className="text-xs text-muted-foreground">Lots</span>
                <span className="font-mono">{closeTarget.lotSize}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmManualClose}>
              <X className="w-4 h-4" /> Close position
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
