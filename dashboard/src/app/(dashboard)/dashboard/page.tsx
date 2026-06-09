"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, DollarSign, TrendingDown, TrendingUp, BarChart2, RefreshCw, X, Target, Percent } from "lucide-react";
// X kept for the close confirm dialog
import { TradeDetailModal } from "@/components/ui/trade-detail-modal";
import { SectionHeader } from "@/components/ui/section-header";
import { StatCard } from "@/components/ui/stat-card";
import { TradeStatusBadge } from "@/components/ui/status-badge";
import { AlertBanner } from "@/components/ui/alert-banner";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EquityAreaChart } from "@/components/charts/equity-area-chart";
import { TradeOutcomeDonut } from "@/components/charts/trade-outcome-donut";
import {
  buildEquitySeries,
  buildOutcomeBreakdown,
} from "@/lib/charts/trade-stats";
import { cn } from "@/lib/utils";
import type { DashboardStats, TradeRow } from "@/types";

function formatTradeDate(iso: string) {
  return new Date(iso).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTradeTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// XAUUSD: 100 oz per 1.0 lot (mirrors bot/utils/lot_sizing.py)
const CONTRACT_SIZE: Record<string, number> = { XAUUSD: 100 };

function floatingPnl(trade: TradeRow, price: number): number {
  const contract = CONTRACT_SIZE[trade.symbol] ?? 100;
  const diff = trade.direction === "SELL"
    ? trade.entryPrice - price
    : price - trade.entryPrice;
  return diff * trade.lotSize * contract;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [chartTrades, setChartTrades] = useState<TradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closeTarget, setCloseTarget] = useState<TradeRow | null>(null);
  const [detailTrade, setDetailTrade] = useState<TradeRow | null>(null);
  const [refPrice, setRefPrice] = useState<number | null>(null);

  async function confirmManualClose() {
    const target = closeTarget;
    if (!target) return;
    setClosingId(target.id);
    setCloseTarget(null);
    try {
      await fetch(`/api/trades/${target.id}/manual-close`, { method: "POST" });
      await fetchData();
    } finally {
      setClosingId(null);
    }
  }

  async function fetchData() {
    try {
      const [s, t, c] = await Promise.all([
        fetch("/api/bot/status").then((r) => r.json()),
        fetch("/api/trades?limit=10").then((r) => r.json()),
        fetch("/api/trades?limit=100").then((r) => r.json()),
      ]);
      setStats(s.status ?? null);
      setTrades(t.trades ?? []);
      setChartTrades(c.trades ?? []);
      setLastRefresh(new Date());
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchPrice() {
      try {
        const r = await fetch("/api/market/price");
        if (!r.ok) return;
        const d = await r.json();
        if (cancelled) return;
        // Value open positions against the futures price the bot trades on.
        setRefPrice(typeof d.refPrice === "number" ? d.refPrice : d.price ?? null);
      } catch {}
    }
    fetchPrice();
    const id = setInterval(fetchPrice, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const hasOpenTrades = useMemo(() => trades.some((t) => t.status === "OPEN"), [trades]);

  const floatingTotal = useMemo(() => {
    if (refPrice == null) return null;
    const open = trades.filter((t) => t.status === "OPEN");
    if (open.length === 0) return null;
    return open.reduce((sum, t) => sum + floatingPnl(t, refPrice), 0);
  }, [trades, refPrice]);

  const balance = stats?.balance ?? 500000;
  const pnlPct = stats ? (stats.dailyPnl / balance) * 100 : 0;
  const pnlTone = !stats ? "neutral" : stats.dailyPnl > 0 ? "profit" : stats.dailyPnl < 0 ? "loss" : "neutral";

  const { winRate, totalPnl } = useMemo(() => {
    const closed = chartTrades.filter((t) => t.status !== "OPEN");
    const wins = closed.filter((t) => t.status === "CLOSED_WIN").length;
    const wr = closed.length > 0 ? (wins / closed.length) * 100 : 0;
    const tp = closed.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    return { winRate: wr, totalPnl: tp };
  }, [chartTrades]);
  const totalPnlTone = totalPnl > 0 ? "profit" : totalPnl < 0 ? "loss" : "neutral";

  const equitySeries = useMemo(
    () => buildEquitySeries(chartTrades, balance, stats?.equity),
    [chartTrades, balance, stats?.equity]
  );

  const outcomeSlices = useMemo(
    () => buildOutcomeBreakdown(chartTrades),
    [chartTrades]
  );

  return (
    <div className="space-y-6">
      {stats?.status === "DAILY_LOCK" && (
        <AlertBanner
          tone="danger"
          title="Daily loss limit reached — bot is locked"
          description="Review today's P&L before restarting. Go to Bot Control to manually restart after review."
        />
      )}
      {stats?.status === "ERROR" && stats.errorMsg && (
        <AlertBanner tone="danger" title="Bot error" description={stats.errorMsg} />
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <StatCard
          label="Equity"
          value={loading ? "—" : `$${(stats?.equity ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
          sub={stats?.balance ? `Balance $${stats.balance.toLocaleString()}` : undefined}
          icon={<DollarSign className="w-4 h-4" />}
          tone="neutral"
        />
        <StatCard
          label="Daily P&L"
          value={loading ? "—" : `${(stats?.dailyPnl ?? 0) >= 0 ? "+" : ""}$${Math.abs(stats?.dailyPnl ?? 0).toFixed(0)}`}
          sub={`${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(3)}%`}
          icon={(stats?.dailyPnl ?? 0) >= 0
            ? <TrendingUp className="w-4 h-4" />
            : <TrendingDown className="w-4 h-4" />}
          tone={pnlTone}
        />
        <StatCard
          label="Drawdown"
          value={loading ? "—" : `${(stats?.drawdownPct ?? 0).toFixed(2)}%`}
          sub="Max allowed: 4.5%"
          icon={<BarChart2 className="w-4 h-4" />}
          tone="neutral"
        />
        <StatCard
          label="Open Trades"
          value={loading ? "—" : String(stats?.openTrades ?? 0)}
          sub={stats?.lastPing
            ? `Ping ${new Date(stats.lastPing).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
            : "No heartbeat"}
          icon={<Activity className="w-4 h-4" />}
          tone="neutral"
        />
        <StatCard
          label="Win Rate"
          value={loading ? "—" : `${winRate.toFixed(1)}%`}
          sub={`${chartTrades.filter((t) => t.status === "CLOSED_WIN").length} wins of ${chartTrades.filter((t) => t.status !== "OPEN").length} closed`}
          icon={<Percent className="w-4 h-4" />}
          tone="neutral"
        />
        <StatCard
          label="Total P&L"
          value={loading ? "—" : `${totalPnl >= 0 ? "+" : ""}$${Math.abs(totalPnl).toFixed(0)}`}
          sub={`${((totalPnl / balance) * 100).toFixed(3)}% of balance`}
          icon={totalPnl >= 0 ? <Target className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          tone={totalPnlTone}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2">
          <EquityAreaChart data={equitySeries} loading={loading} />
        </div>
        <div className="lg:col-span-1">
          <TradeOutcomeDonut
            slices={outcomeSlices}
            trades={chartTrades}
            loading={loading}
          />
        </div>
      </div>


      {/* Recent trades table */}
      <div>
        <SectionHeader
          title="Recent Trades"
          description={`${trades.length} shown${
            floatingTotal != null
              ? ` · floating ${floatingTotal >= 0 ? "+" : "−"}$${Math.abs(floatingTotal).toFixed(0)}`
              : ""
          }${lastRefresh ? ` · updated ${lastRefresh.toLocaleTimeString()}` : ""}`}
        >
          <Button variant="ghost" size="sm" onClick={fetchData} className="h-7 text-xs gap-1.5">
            <RefreshCw className="w-3 h-3" /> Refresh
          </Button>
        </SectionHeader>

        {loading ? (
          <div className="rounded-lg border border-border bg-card">
            <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
          </div>
        ) : trades.length === 0 ? (
          <div className="rounded-lg border border-border bg-card">
            <EmptyState
              icon={<TrendingUp className="w-5 h-5" />}
              title="No trades yet"
              description="Trades will appear here once the bot is running."
            />
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Date</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground hidden sm:table-cell">Time</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Symbol</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Dir</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Entry</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground hidden sm:table-cell">SL</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground hidden sm:table-cell">TP</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">P&L</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Status</th>
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
                      <td className="px-4 py-2.5 text-xs tabular whitespace-nowrap">
                        <div>{formatTradeDate(t.openTime)}</div>
                        <div className="text-muted-foreground sm:hidden">{formatTradeTime(t.openTime)}</div>
                        {t.closeTime && (
                          <div className="text-[10px] text-muted-foreground/60 mt-0.5 hidden sm:block">
                            Closed {formatTradeDate(t.closeTime)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs tabular text-muted-foreground whitespace-nowrap hidden sm:table-cell">
                        {formatTradeTime(t.openTime)}
                        {t.closeTime && (
                          <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                            {formatTradeTime(t.closeTime)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs font-medium">{t.symbol}</td>
                      <td className="px-4 py-2.5">
                        <span className={cn(
                          "inline-block w-2 h-2 rounded-full",
                          t.direction === "BUY" ? "bg-emerald-500" : "bg-red-500"
                        )} />
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs tabular">{t.entryPrice.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs tabular text-[--loss] hidden sm:table-cell">{t.stopLoss.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs tabular text-[--profit] hidden sm:table-cell">{t.takeProfit.toFixed(2)}</td>
                      {(() => {
                        const isLive = t.status === "OPEN" && refPrice != null;
                        const displayPnl = isLive
                          ? floatingPnl(t, refPrice!)
                          : t.pnl;
                        const pnlColor =
                          t.status === "CLOSED_WIN" ? "text-emerald-400"
                          : t.status === "CLOSED_LOSS" ? "text-red-400"
                          : t.status === "CLOSED_BE" ? "text-muted-foreground"
                          : (displayPnl ?? 0) > 0 ? "text-emerald-400"
                          : (displayPnl ?? 0) < 0 ? "text-red-400"
                          : "text-muted-foreground";
                        return (
                          <td className={`px-4 py-2.5 text-right font-mono text-xs tabular ${pnlColor}`}>
                            {displayPnl != null ? (
                              <span className="inline-flex items-center justify-end gap-1.5">
                                {isLive && (
                                  <span
                                    className="w-1.5 h-1.5 rounded-full bg-current opacity-70 animate-pulse"
                                    title="Live — updates with market price"
                                  />
                                )}
                                {`${displayPnl >= 0 ? "+" : ""}$${Math.abs(displayPnl).toFixed(0)}`}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        );
                      })()}
                      <td className="px-4 py-2.5 text-right">
                        <TradeStatusBadge status={t.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <TradeDetailModal
        trade={detailTrade}
        refPrice={refPrice}
        closingId={closingId}
        onClose={() => setDetailTrade(null)}
        onRequestClose={(t) => setCloseTarget(t)}
      />

      <Dialog open={closeTarget != null} onOpenChange={(o) => !o && setCloseTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-[--loss]/10 text-[--loss]">
                <X className="w-4 h-4" />
              </span>
              <div>
                <DialogTitle>Close position</DialogTitle>
                <DialogDescription>Close at the current market price.</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {closeTarget && (() => {
            const live = refPrice != null ? floatingPnl(closeTarget, refPrice) : null;
            const positive = (live ?? 0) >= 0;
            return (
              <div className="rounded-lg border border-border bg-muted/30 divide-y divide-border text-sm">
                <Row label="Symbol" value={
                  <span className="flex items-center gap-2 font-mono">
                    <span className={cn(
                      "inline-block w-2 h-2 rounded-full",
                      closeTarget.direction === "BUY" ? "bg-emerald-500" : "bg-red-500"
                    )} />
                    {closeTarget.symbol} · {closeTarget.direction}
                  </span>
                } />
                <Row label="Lot size" value={<span className="font-mono tabular">{closeTarget.lotSize}</span>} />
                <Row label="Entry" value={<span className="font-mono tabular">{closeTarget.entryPrice.toFixed(2)}</span>} />
                <Row label="Market" value={
                  <span className="font-mono tabular">
                    {refPrice != null ? refPrice.toFixed(2) : "—"}
                  </span>
                } />
                <Row
                  label="Floating P&L"
                  value={
                    live != null ? (
                      <span className={cn("font-mono tabular font-semibold", positive ? "text-[--profit]" : "text-[--loss]")}>
                        {positive ? "+" : "−"}${Math.abs(live).toFixed(2)}
                      </span>
                    ) : <span className="text-muted-foreground">—</span>
                  }
                />
              </div>
            );
          })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmManualClose}>
              <X className="w-4 h-4" />
              Close position
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3.5 py-2.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {value}
    </div>
  );
}
