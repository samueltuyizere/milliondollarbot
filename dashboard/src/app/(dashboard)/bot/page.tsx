"use client";

import { useEffect, useState } from "react";
import { Play, Pause, Square, Activity, RefreshCw, Clock, Wallet } from "lucide-react";
import { toast } from "sonner";
import { StatCard } from "@/components/ui/stat-card";
import { AlertBanner } from "@/components/ui/alert-banner";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BotState } from "@/types";

interface BotStatusData {
  status: BotState;
  lastPing: string | null;
  equity: number | null;
  balance: number | null;
  dailyPnl: number | null;
  drawdownPct: number | null;
  openTrades: number;
  errorMsg: string | null;
}

export default function BotControlPage() {
  const [data, setData] = useState<BotStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  async function fetchStatus() {
    try {
      const r = await fetch("/api/bot/status");
      const j = await r.json();
      setData(j.status);
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 3000);
    return () => clearInterval(id);
  }, []);

  async function sendCommand(command: "start" | "stop" | "pause" | "resume") {
    setActing(true);
    try {
      const r = await fetch("/api/bot/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      });
      const j = await r.json();
      if (j.ok) {
        toast.success(`Bot ${command} command sent`);
        await fetchStatus();
      } else {
        toast.error(j.error ?? "Command failed");
      }
    } catch {
      toast.error("Failed to send command");
    }
    setActing(false);
  }

  const s = data?.status ?? "STOPPED";

  const fmt = (v: number | null | undefined, prefix = "$", decimals = 0) =>
    v != null ? `${prefix}${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}` : "—";

  return (
    <div className="space-y-6 max-w-2xl">
      {s === "DAILY_LOCK" && (
        <AlertBanner
          tone="danger"
          title="Daily loss limit reached — bot is locked"
          description="Review today's P&L before restarting. Only a manual Start will resume trading."
        />
      )}
      {s === "ERROR" && data?.errorMsg && (
        <AlertBanner tone="danger" title="Bot error" description={data.errorMsg} />
      )}

      {/* Live stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Equity"
          value={loading ? "—" : fmt(data?.equity)}
          icon={<Wallet className="w-4 h-4" />}
        />
        <StatCard
          label="Daily P&L"
          value={loading ? "—" : (data?.dailyPnl != null ? `${data.dailyPnl >= 0 ? "+" : "-"}${fmt(data.dailyPnl)}` : "—")}
          tone={(data?.dailyPnl ?? 0) > 0 ? "profit" : (data?.dailyPnl ?? 0) < 0 ? "loss" : "neutral"}
        />
        <StatCard
          label="Drawdown"
          value={loading ? "—" : `${(data?.drawdownPct ?? 0).toFixed(2)}%`}
          tone={(data?.drawdownPct ?? 0) > 3 ? "loss" : (data?.drawdownPct ?? 0) > 1.5 ? "warning" : "neutral"}
        />
        <StatCard
          label="Open"
          value={loading ? "—" : String(data?.openTrades ?? 0)}
          sub={data?.lastPing
            ? new Date(data.lastPing).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
            : undefined}
          icon={<Activity className="w-4 h-4" />}
        />
      </div>

      {/* Controls */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 pt-4 pb-3 border-b border-border">
          <SectionHeader title="Controls" className="mb-0">
            <Button variant="ghost" size="sm" onClick={fetchStatus} className="h-7 w-7 p-0">
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </SectionHeader>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {/* Start / Resume */}
            <button
              onClick={() => sendCommand(s === "PAUSED" ? "resume" : "start")}
              disabled={acting || s === "RUNNING"}
              className={cn(
                "flex flex-col items-center gap-2 rounded-lg border py-4 px-3 text-sm font-medium transition-all",
                s === "RUNNING"
                  ? "bg-[--profit]/10 border-[--profit]/30 text-[--profit] cursor-default"
                  : "border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-40"
              )}
            >
              <Play className={cn("w-5 h-5", s === "RUNNING" ? "text-[--profit]" : "")} />
              {s === "PAUSED" ? "Resume" : "Start"}
            </button>

            {/* Pause */}
            <button
              onClick={() => sendCommand("pause")}
              disabled={acting || s !== "RUNNING"}
              className={cn(
                "flex flex-col items-center gap-2 rounded-lg border py-4 px-3 text-sm font-medium transition-all",
                s === "PAUSED"
                  ? "bg-amber-400/10 border-amber-400/30 text-amber-400 cursor-default"
                  : "border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-40"
              )}
            >
              <Pause className="w-5 h-5" />
              Pause
            </button>

            {/* Stop */}
            <button
              onClick={() => sendCommand("stop")}
              disabled={acting || s === "STOPPED"}
              className={cn(
                "flex flex-col items-center gap-2 rounded-lg border py-4 px-3 text-sm font-medium transition-all",
                s === "STOPPED"
                  ? "bg-muted/50 border-border text-muted-foreground cursor-default"
                  : "border-border bg-card hover:bg-[--loss]/10 hover:border-[--loss]/30 hover:text-[--loss] text-muted-foreground disabled:opacity-40"
              )}
            >
              <Square className="w-5 h-5" />
              Stop
            </button>
          </div>

          {/* Status row */}
          <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            {data?.lastPing
              ? `Last heartbeat: ${new Date(data.lastPing).toLocaleString()}`
              : "No heartbeat received yet"}
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Stop</strong> sends a graceful shutdown — the bot finishes any pending actions first.
            After a <strong className="text-foreground">Daily Lock</strong>, only a manual Start can resume trading. Review your P&L first.
          </p>
        </div>
      </div>
    </div>
  );
}
