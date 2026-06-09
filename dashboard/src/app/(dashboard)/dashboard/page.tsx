"use client";

import { useEffect, useState } from "react";
import { Activity, DollarSign, TrendingDown, TrendingUp, BarChart2, RefreshCw } from "lucide-react";
import { SectionHeader } from "@/components/ui/section-header";
import { StatCard } from "@/components/ui/stat-card";
import { BotStatusBadge, TradeStatusBadge, DirectionBadge } from "@/components/ui/status-badge";
import { AlertBanner } from "@/components/ui/alert-banner";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import type { DashboardStats, TradeRow } from "@/types";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  async function fetchData() {
    try {
      const [s, t] = await Promise.all([
        fetch("/api/bot/status").then(r => r.json()),
        fetch("/api/trades?limit=10").then(r => r.json()),
      ]);
      setStats(s.status ?? null);
      setTrades(t.trades ?? []);
      setLastRefresh(new Date());
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 5000);
    return () => clearInterval(id);
  }, []);

  const balance = stats?.balance ?? 500000;
  const pnlPct = stats ? ((stats.dailyPnl / balance) * 100) : 0;
  const pnlTone = !stats ? "neutral" : stats.dailyPnl > 0 ? "profit" : stats.dailyPnl < 0 ? "loss" : "neutral";
  const ddTone = !stats ? "neutral" : stats.drawdownPct > 3 ? "loss" : stats.drawdownPct > 1.5 ? "warning" : "profit";

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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Equity"
          value={loading ? "—" : `$${(stats?.equity ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
          sub={stats?.balance ? `Balance $${stats.balance.toLocaleString()}` : undefined}
          icon={<DollarSign className="w-4 h-4" />}
          tone="gold"
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
          tone={ddTone}
        />
        <StatCard
          label="Open Trades"
          value={loading ? "—" : String(stats?.openTrades ?? 0)}
          sub={stats?.lastPing
            ? `Ping ${new Date(stats.lastPing).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
            : "No heartbeat"}
          icon={<Activity className="w-4 h-4" />}
          tone={stats?.openTrades ? "gold" : "neutral"}
        />
      </div>

      {/* Drawdown progress bar */}
      {stats && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Drawdown</span>
            <span className="tabular">{stats.drawdownPct.toFixed(2)}% / 4.5%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min((stats.drawdownPct / 4.5) * 100, 100)}%`,
                background: stats.drawdownPct > 3
                  ? "var(--loss)"
                  : stats.drawdownPct > 1.5
                  ? "oklch(0.78 0.16 75)"
                  : "var(--profit)",
              }}
            />
          </div>
        </div>
      )}

      {/* Recent trades table */}
      <div>
        <SectionHeader title="Recent Trades" description={`${trades.length} shown`}>
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
                  {trades.map(t => (
                    <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-xs font-medium">{t.symbol}</td>
                      <td className="px-4 py-2.5">
                        <DirectionBadge direction={t.direction} />
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs tabular">{t.entryPrice.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs tabular text-[--loss] hidden sm:table-cell">{t.stopLoss.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs tabular text-[--profit] hidden sm:table-cell">{t.takeProfit.toFixed(2)}</td>
                      <td className={`px-4 py-2.5 text-right font-mono text-xs tabular ${(t.pnl ?? 0) >= 0 ? "text-[--profit]" : "text-[--loss]"}`}>
                        {t.pnl != null
                          ? `${t.pnl >= 0 ? "+" : ""}$${Math.abs(t.pnl).toFixed(0)}`
                          : <span className="text-muted-foreground">—</span>}
                      </td>
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
    </div>
  );
}
