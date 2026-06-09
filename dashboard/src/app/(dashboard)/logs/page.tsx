"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { SectionHeader } from "@/components/ui/section-header";
import { EmptyState } from "@/components/ui/empty-state";
import { LogLevelBadge, DirectionBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SystemLog { id: string; level: string; source: string; message: string; createdAt: string; }
interface TradeLogEntry { id: string; tradeId: string; event: string; message: string; createdAt: string; }
interface AuditEntry { id: string; userId?: string | null; action: string; resource?: string | null; createdAt: string; }

// ─── System logs ──────────────────────────────────────────────────────────────

function SystemLogs() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");

  async function load() {
    setLoading(true);
    try { setLogs((await fetch("/api/logs/system?limit=200").then(r => r.json())).logs ?? []); }
    catch {}
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const levels = ["ALL", "INFO", "WARNING", "ERROR", "CRITICAL"];
  const visible = filter === "ALL" ? logs : logs.filter(l => l.level === filter);

  return (
    <div className="space-y-3">
      <SectionHeader title="System Logs" description={`${visible.length} entries`}>
        <div className="flex items-center gap-1.5">
          {levels.map(l => (
            <button key={l} onClick={() => setFilter(l)}
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide transition-colors",
                filter === l
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}>
              {l === "ALL" ? "All" : l.slice(0, 4)}
            </button>
          ))}
          <Button variant="ghost" size="sm" onClick={load} className="h-6 w-6 p-0 ml-1">
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
      </SectionHeader>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="log-panel font-mono text-xs divide-y divide-border/50 max-h-[560px] overflow-y-auto">
          {loading && <div className="px-4 py-8 text-center text-muted-foreground">Loading…</div>}
          {!loading && visible.length === 0 && (
            <EmptyState icon={<ScrollText className="w-4 h-4" />} title="No system logs" description="Logs appear here once the bot starts running." />
          )}
          {visible.map(l => (
            <div key={l.id} className="flex items-start gap-3 px-4 py-2 hover:bg-muted/20 transition-colors">
              <span className="text-muted-foreground/60 shrink-0 tabular text-[10px] mt-0.5 w-16">
                {new Date(l.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
              <LogLevelBadge level={l.level as "INFO"} />
              <span className="text-muted-foreground shrink-0 w-12 text-[10px] mt-0.5">[{l.source}]</span>
              <span className="text-foreground/80 break-all leading-relaxed">{l.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Trade logs ───────────────────────────────────────────────────────────────

function TradeLogs() {
  const [logs, setLogs] = useState<TradeLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try { setLogs((await fetch("/api/logs/trades?limit=200").then(r => r.json())).logs ?? []); }
    catch {}
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const EVENT_STYLE: Record<string, string> = {
    OPENED: "text-[--profit]",
    CLOSED: "text-blue-400",
    REJECTED: "text-[--loss]",
    ERROR: "text-[--loss]",
  };

  return (
    <div className="space-y-3">
      <SectionHeader title="Trade Logs" description={`${logs.length} entries`}>
        <Button variant="ghost" size="sm" onClick={load} className="h-6 w-6 p-0">
          <RefreshCw className="w-3 h-3" />
        </Button>
      </SectionHeader>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="log-panel font-mono text-xs divide-y divide-border/50 max-h-[560px] overflow-y-auto">
          {loading && <div className="px-4 py-8 text-center text-muted-foreground">Loading…</div>}
          {!loading && logs.length === 0 && (
            <EmptyState icon={<ScrollText className="w-4 h-4" />} title="No trade logs" description="Trade events appear here as the bot opens and closes positions." />
          )}
          {logs.map(l => (
            <div key={l.id} className="flex items-start gap-3 px-4 py-2 hover:bg-muted/20 transition-colors">
              <span className="text-muted-foreground/60 shrink-0 text-[10px] mt-0.5 w-16 tabular">
                {new Date(l.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
              <span className={cn("shrink-0 text-[10px] uppercase tracking-wider w-14", EVENT_STYLE[l.event] ?? "text-muted-foreground")}>
                {l.event}
              </span>
              <span className="text-muted-foreground/60 shrink-0 text-[10px] mt-0.5">#{l.tradeId.slice(-6)}</span>
              <span className="text-foreground/80 break-all leading-relaxed">{l.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Audit logs ───────────────────────────────────────────────────────────────

function AuditLogs() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try { setLogs((await fetch("/api/logs/audit?limit=200").then(r => r.json())).logs ?? []); }
    catch {}
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-3">
      <SectionHeader title="Audit Trail" description={`${logs.length} entries`}>
        <Button variant="ghost" size="sm" onClick={load} className="h-6 w-6 p-0">
          <RefreshCw className="w-3 h-3" />
        </Button>
      </SectionHeader>

      {logs.length === 0 && !loading ? (
        <div className="rounded-lg border border-border bg-card">
          <EmptyState icon={<ScrollText className="w-4 h-4" />} title="No audit entries" description="Config changes and bot commands will appear here." />
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Time</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Action</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground hidden sm:table-cell">Resource</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground hidden md:table-cell">User</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono">
              {loading && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>}
              {logs.map(l => (
                <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5 text-muted-foreground tabular whitespace-nowrap">
                    {new Date(l.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-4 py-2.5 text-[--gold] font-medium">{l.action}</td>
                  <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">{l.resource ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell">{l.userId?.slice(-6) ?? "system"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LogsPage() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="system">
        <TabsList className="h-9 p-1 bg-muted">
          <TabsTrigger value="system"  className="h-7 text-xs">System</TabsTrigger>
          <TabsTrigger value="trades"  className="h-7 text-xs">Trades</TabsTrigger>
          <TabsTrigger value="audit"   className="h-7 text-xs">Audit</TabsTrigger>
        </TabsList>
        <TabsContent value="system"  className="mt-4"><SystemLogs /></TabsContent>
        <TabsContent value="trades"  className="mt-4"><TradeLogs /></TabsContent>
        <TabsContent value="audit"   className="mt-4"><AuditLogs /></TabsContent>
      </Tabs>
    </div>
  );
}
