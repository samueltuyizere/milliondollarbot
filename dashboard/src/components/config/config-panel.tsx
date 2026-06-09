"use client";

import { useEffect, useState } from "react";
import { Shield, TrendingUp, Bot, Save } from "lucide-react";
import { toast } from "sonner";
import { SectionHeader } from "@/components/ui/section-header";
import { FieldRow } from "@/components/ui/field-row";
import { AlertBanner } from "@/components/ui/alert-banner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { RiskConfig, StrategyConfigData, BotConfigData } from "@/types";

function RiskTab() {
  const [cfg, setCfg] = useState<RiskConfig>({
    riskPerTradePct: 0.25,
    maxDailyLossPct: 1.0,
    maxDrawdownPct: 4.5,
    minRR: 2.0,
    maxOpenTrades: 1,
    dailyLockActive: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/config/risk")
      .then((r) => r.json())
      .then((j) => {
        if (j.risk) setCfg(j.risk);
      })
      .catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    try {
      const r = await fetch("/api/config/risk", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      const j = await r.json();
      j.ok ? toast.success("Risk rules saved") : toast.error(j.error ?? "Save failed");
    } catch {
      toast.error("Save failed");
    }
    setSaving(false);
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <SectionHeader title="Risk Rules" className="mb-0">
          <Shield className="w-4 h-4 text-[--loss]" />
        </SectionHeader>
        <p className="text-xs text-muted-foreground mt-1">
          Enforced before every trade. Daily lock cannot be overridden from the UI.
        </p>
      </div>

      <div className="px-4">
        <FieldRow
          label="Risk per trade"
          hint={`0.25% = $${((200000 * cfg.riskPerTradePct) / 100).toLocaleString()} on $200k`}
        >
          <div className="flex items-center gap-2">
            <Input
              type="number"
              step="0.05"
              min="0.1"
              max="1"
              value={cfg.riskPerTradePct}
              onChange={(e) =>
                setCfg((c) => ({ ...c, riskPerTradePct: parseFloat(e.target.value) }))
              }
              className="font-mono w-24 h-8 text-sm"
            />
            <span className="text-xs text-muted-foreground">%</span>
          </div>
        </FieldRow>
        <FieldRow label="Max daily loss" hint="Hard lock triggers at this level">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              step="0.1"
              min="0.5"
              max="3"
              value={cfg.maxDailyLossPct}
              onChange={(e) =>
                setCfg((c) => ({ ...c, maxDailyLossPct: parseFloat(e.target.value) }))
              }
              className="font-mono w-24 h-8 text-sm"
            />
            <span className="text-xs text-muted-foreground">%</span>
          </div>
        </FieldRow>
        <FieldRow label="Max drawdown" hint="Soft stop before account limit">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              step="0.1"
              min="2"
              max="5"
              value={cfg.maxDrawdownPct}
              onChange={(e) =>
                setCfg((c) => ({ ...c, maxDrawdownPct: parseFloat(e.target.value) }))
              }
              className="font-mono w-24 h-8 text-sm"
            />
            <span className="text-xs text-muted-foreground">%</span>
          </div>
        </FieldRow>
        <FieldRow label="Minimum R:R" hint="Trades rejected if TP/SL ratio is below this">
          <Input
            type="number"
            step="0.25"
            min="1.5"
            max="5"
            value={cfg.minRR}
            onChange={(e) => setCfg((c) => ({ ...c, minRR: parseFloat(e.target.value) }))}
            className="font-mono w-24 h-8 text-sm"
          />
        </FieldRow>
        <FieldRow label="Max open trades" hint="Phase 1: keep at 1">
          <Input
            type="number"
            step="1"
            min="1"
            max="3"
            value={cfg.maxOpenTrades}
            onChange={(e) =>
              setCfg((c) => ({ ...c, maxOpenTrades: parseInt(e.target.value) }))
            }
            className="font-mono w-24 h-8 text-sm"
          />
        </FieldRow>
      </div>

      {cfg.dailyLockActive && (
        <div className="px-4 pb-4">
          <AlertBanner
            tone="danger"
            title="Daily lock is currently active"
            description="The bot will not trade until you manually restart it."
          />
        </div>
      )}

      <div className="px-4 py-4 border-t border-border bg-muted/20">
        <Button onClick={save} disabled={saving} size="sm" className="gap-2">
          <Save className="w-3.5 h-3.5" />
          {saving ? "Saving…" : "Save Risk Rules"}
        </Button>
      </div>
    </div>
  );
}

function StrategyTab() {
  const [cfg, setCfg] = useState<StrategyConfigData>({
    emaFast: 21,
    emaSlow: 50,
    rsiPeriod: 14,
    rsiOversold: 40,
    atrPeriod: 14,
    atrMultiSl: 1.5,
    timeframe: "H1",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/config/strategy")
      .then((r) => r.json())
      .then((j) => {
        if (j.strategy) setCfg(j.strategy);
      })
      .catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    try {
      const r = await fetch("/api/config/strategy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      const j = await r.json();
      j.ok ? toast.success("Strategy config saved") : toast.error(j.error ?? "Save failed");
    } catch {
      toast.error("Save failed");
    }
    setSaving(false);
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <SectionHeader title="H1 EMA Pullback" className="mb-0">
          <TrendingUp className="w-4 h-4 text-[--gold]" />
        </SectionHeader>
        <p className="text-xs text-muted-foreground mt-1">
          XAUUSD hourly EMA pullback with RSI confirmation and ATR-based stops.
        </p>
      </div>

      <div className="px-4">
        <FieldRow label="Timeframe" hint="Phase 1: H1 only">
          <Input value={cfg.timeframe} disabled className="font-mono w-24 h-8 text-sm opacity-60" />
        </FieldRow>
        <FieldRow label="EMA Fast" hint="Pullback reference line">
          <Input
            type="number"
            value={cfg.emaFast}
            onChange={(e) => setCfg((c) => ({ ...c, emaFast: parseInt(e.target.value) }))}
            className="font-mono w-24 h-8 text-sm"
          />
        </FieldRow>
        <FieldRow label="EMA Slow" hint="Trend direction filter">
          <Input
            type="number"
            value={cfg.emaSlow}
            onChange={(e) => setCfg((c) => ({ ...c, emaSlow: parseInt(e.target.value) }))}
            className="font-mono w-24 h-8 text-sm"
          />
        </FieldRow>
        <FieldRow label="RSI Period" hint="Momentum confirmation">
          <Input
            type="number"
            value={cfg.rsiPeriod}
            onChange={(e) => setCfg((c) => ({ ...c, rsiPeriod: parseInt(e.target.value) }))}
            className="font-mono w-24 h-8 text-sm"
          />
        </FieldRow>
        <FieldRow label="RSI Oversold" hint="Only enter when RSI is below this value">
          <Input
            type="number"
            value={cfg.rsiOversold}
            onChange={(e) =>
              setCfg((c) => ({ ...c, rsiOversold: parseFloat(e.target.value) }))
            }
            className="font-mono w-24 h-8 text-sm"
          />
        </FieldRow>
        <FieldRow label="ATR Period" hint="Stop-loss sizing">
          <Input
            type="number"
            value={cfg.atrPeriod}
            onChange={(e) => setCfg((c) => ({ ...c, atrPeriod: parseInt(e.target.value) }))}
            className="font-mono w-24 h-8 text-sm"
          />
        </FieldRow>
        <FieldRow label="ATR SL multiplier" hint="SL = entry − (ATR × multiplier)">
          <Input
            type="number"
            step="0.1"
            value={cfg.atrMultiSl}
            onChange={(e) =>
              setCfg((c) => ({ ...c, atrMultiSl: parseFloat(e.target.value) }))
            }
            className="font-mono w-24 h-8 text-sm"
          />
        </FieldRow>
      </div>

      <div className="px-4 py-4 border-t border-border bg-muted/20">
        <Button onClick={save} disabled={saving} size="sm" className="gap-2">
          <Save className="w-3.5 h-3.5" />
          {saving ? "Saving…" : "Save Strategy"}
        </Button>
      </div>
    </div>
  );
}

function BotSettingsTab() {
  const [cfg, setCfg] = useState<BotConfigData>({
    symbol: "XAUUSD",
    isRunning: false,
    isPaused: false,
    longOnly: true,
    sessionStart: "08:00",
    sessionEnd: "17:00",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/config/bot")
      .then((r) => r.json())
      .then((j) => {
        if (j.config) setCfg(j.config);
      })
      .catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    try {
      const r = await fetch("/api/config/bot", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      const j = await r.json();
      j.ok ? toast.success("Bot settings saved") : toast.error(j.error ?? "Save failed");
    } catch {
      toast.error("Save failed");
    }
    setSaving(false);
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <SectionHeader title="Bot Settings" className="mb-0">
          <Bot className="w-4 h-4 text-blue-400" />
        </SectionHeader>
        <p className="text-xs text-muted-foreground mt-1">
          Session window and trading direction. Changes take effect on next bot loop.
        </p>
      </div>

      <div className="px-4">
        <FieldRow label="Symbol" hint="Phase 1: XAUUSD only">
          <Input value={cfg.symbol} disabled className="font-mono w-32 h-8 text-sm opacity-60" />
        </FieldRow>
        <FieldRow label="Long only mode" hint="Disables SELL trades">
          <Switch
            checked={cfg.longOnly}
            onCheckedChange={(v) => setCfg((c) => ({ ...c, longOnly: v }))}
          />
        </FieldRow>
        <FieldRow label="Session start (UTC)" hint="No trades placed before this time">
          <Input
            type="time"
            value={cfg.sessionStart}
            onChange={(e) => setCfg((c) => ({ ...c, sessionStart: e.target.value }))}
            className="font-mono w-32 h-8 text-sm"
          />
        </FieldRow>
        <FieldRow label="Session end (UTC)" hint="No trades placed after this time">
          <Input
            type="time"
            value={cfg.sessionEnd}
            onChange={(e) => setCfg((c) => ({ ...c, sessionEnd: e.target.value }))}
            className="font-mono w-32 h-8 text-sm"
          />
        </FieldRow>
      </div>

      <div className="px-4 py-4 border-t border-border bg-muted/20">
        <Button onClick={save} disabled={saving} size="sm" className="gap-2">
          <Save className="w-3.5 h-3.5" />
          {saving ? "Saving…" : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}

export function ConfigPanel() {
  return (
    <Tabs defaultValue="risk">
      <TabsList className="h-9 p-1 bg-muted w-full sm:w-auto">
        <TabsTrigger value="risk" className="h-7 text-xs flex-1 sm:flex-none">
          Risk Rules
        </TabsTrigger>
        <TabsTrigger value="strategy" className="h-7 text-xs flex-1 sm:flex-none">
          Strategy
        </TabsTrigger>
        <TabsTrigger value="bot" className="h-7 text-xs flex-1 sm:flex-none">
          Bot Settings
        </TabsTrigger>
      </TabsList>
      <TabsContent value="risk" className="mt-4">
        <RiskTab />
      </TabsContent>
      <TabsContent value="strategy" className="mt-4">
        <StrategyTab />
      </TabsContent>
      <TabsContent value="bot" className="mt-4">
        <BotSettingsTab />
      </TabsContent>
    </Tabs>
  );
}
