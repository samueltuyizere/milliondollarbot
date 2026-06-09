"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Calendar, AlertOctagon } from "lucide-react";
import { toast } from "sonner";
import { SectionHeader } from "@/components/ui/section-header";
import { EmptyState } from "@/components/ui/empty-state";
import { AlertBanner } from "@/components/ui/alert-banner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type Impact = "LOW" | "MEDIUM" | "HIGH";

const IMPACT_STYLE: Record<Impact, string> = {
  HIGH:   "text-[--loss] bg-[--loss]/10 border-[--loss]/20",
  MEDIUM: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  LOW:    "text-muted-foreground bg-muted border-border",
};

interface NewsEvent {
  id: string; title: string; currency: string; impact: Impact;
  eventTime: string; skipTrading: boolean; minutesBefore: number; minutesAfter: number;
}
interface BankHoliday {
  id: string; country: string; name: string; date: string; description?: string | null;
}

// ─── News tab ─────────────────────────────────────────────────────────────────

function NewsTab() {
  const [events, setEvents] = useState<NewsEvent[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    title: "", currency: "USD", impact: "HIGH" as Impact,
    eventTime: "", skipTrading: true, minutesBefore: 30, minutesAfter: 30,
  });

  async function load() {
    try { setEvents((await fetch("/api/calendar/news").then(r => r.json())).events ?? []); } catch {}
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!form.title || !form.eventTime) { toast.error("Title and time are required"); return; }
    try {
      const j = await fetch("/api/calendar/news", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      }).then(r => r.json());
      if (j.ok) { toast.success("Event added"); setAdding(false); setForm(f => ({ ...f, title: "", eventTime: "" })); load(); }
      else toast.error(j.error ?? "Failed");
    } catch { toast.error("Failed"); }
  }

  async function remove(id: string) {
    try { await fetch(`/api/calendar/news/${id}`, { method: "DELETE" }); toast.success("Removed"); load(); }
    catch { toast.error("Failed"); }
  }

  return (
    <div className="space-y-4">
      <AlertBanner
        tone="info"
        title="News blackout window"
        description="When a HIGH-impact event has skip_trading=on, the bot won't place new trades within the configured minutes before/after."
      />

      <SectionHeader title="Scheduled Events" description={`${events.length} events`}>
        <Button size="sm" onClick={() => setAdding(!adding)} variant={adding ? "secondary" : "default"} className="h-7 gap-1.5 text-xs">
          <Plus className="w-3 h-3" />{adding ? "Cancel" : "Add Event"}
        </Button>
      </SectionHeader>

      {adding && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
          <h3 className="text-sm font-medium">New news event</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Title *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. US CPI" className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Currency</Label>
              <Input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className="h-8 text-sm font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Impact</Label>
              <select value={form.impact} onChange={e => setForm(f => ({ ...f, impact: e.target.value as Impact }))}
                className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm">
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Event time (UTC) *</Label>
              <Input type="datetime-local" value={form.eventTime} onChange={e => setForm(f => ({ ...f, eventTime: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Skip before (min)</Label>
              <Input type="number" value={form.minutesBefore} onChange={e => setForm(f => ({ ...f, minutesBefore: parseInt(e.target.value) }))} className="h-8 text-sm font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Skip after (min)</Label>
              <Input type="number" value={form.minutesAfter} onChange={e => setForm(f => ({ ...f, minutesAfter: parseInt(e.target.value) }))} className="h-8 text-sm font-mono" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.skipTrading} onCheckedChange={v => setForm(f => ({ ...f, skipTrading: v }))} />
            <Label className="text-xs">Skip trading during this event</Label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={add} className="gap-1.5"><Plus className="w-3 h-3" />Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {events.length === 0 ? (
        <div className="rounded-lg border border-border bg-card">
          <EmptyState icon={<AlertOctagon className="w-4 h-4" />} title="No news events" description="Add high-impact events to prevent trading during volatile periods." />
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card divide-y divide-border overflow-hidden">
          {events.map(ev => (
            <div key={ev.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
              <AlertOctagon className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{ev.title}</p>
                <p className="text-xs text-muted-foreground tabular">
                  {new Date(ev.eventTime).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  {" · "}±{ev.minutesBefore}min · {ev.currency}
                </p>
              </div>
              <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium border", IMPACT_STYLE[ev.impact])}>
                {ev.impact}
              </span>
              <span className={cn("px-2 py-0.5 rounded-full text-xs border",
                ev.skipTrading ? "text-[--loss] bg-[--loss]/10 border-[--loss]/20" : "text-muted-foreground bg-muted border-border")}>
                {ev.skipTrading ? "Skip" : "Allow"}
              </span>
              <Button variant="ghost" size="sm" onClick={() => remove(ev.id)}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-[--loss] shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Holidays tab ─────────────────────────────────────────────────────────────

function HolidaysTab() {
  const [holidays, setHolidays] = useState<BankHoliday[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ country: "US", name: "", date: "", description: "" });

  async function load() {
    try { setHolidays((await fetch("/api/calendar/holidays").then(r => r.json())).holidays ?? []); } catch {}
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!form.name || !form.date) { toast.error("Name and date required"); return; }
    try {
      const j = await fetch("/api/calendar/holidays", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      }).then(r => r.json());
      if (j.ok) { toast.success("Holiday added"); setAdding(false); setForm(f => ({ ...f, name: "", date: "" })); load(); }
      else toast.error(j.error ?? "Failed");
    } catch { toast.error("Failed"); }
  }

  async function remove(id: string) {
    try { await fetch(`/api/calendar/holidays/${id}`, { method: "DELETE" }); toast.success("Removed"); load(); }
    catch { toast.error("Failed"); }
  }

  return (
    <div className="space-y-4">
      <AlertBanner tone="info" title="Bank holidays" description="The bot will not place trades on these dates." />

      <SectionHeader title="Holidays" description={`${holidays.length} entries`}>
        <Button size="sm" onClick={() => setAdding(!adding)} variant={adding ? "secondary" : "default"} className="h-7 gap-1.5 text-xs">
          <Plus className="w-3 h-3" />{adding ? "Cancel" : "Add Holiday"}
        </Button>
      </SectionHeader>

      {adding && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
          <h3 className="text-sm font-medium">New bank holiday</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Country</Label>
              <Input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} className="h-8 text-sm font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Holiday name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Christmas Day" className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Date *</Label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes (optional)</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="h-8 text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={add} className="gap-1.5"><Plus className="w-3 h-3" />Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {holidays.length === 0 ? (
        <div className="rounded-lg border border-border bg-card">
          <EmptyState icon={<Calendar className="w-4 h-4" />} title="No bank holidays" description="Add dates when the bot should not trade." />
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card divide-y divide-border overflow-hidden">
          {holidays.map(h => (
            <div key={h.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
              <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{h.name}</p>
                <p className="text-xs text-muted-foreground tabular">
                  {new Date(h.date).toLocaleDateString([], { year: "numeric", month: "long", day: "numeric" })}
                  {h.description ? ` · ${h.description}` : ""}
                </p>
              </div>
              <span className="text-xs font-mono text-muted-foreground px-2 py-0.5 bg-muted rounded">{h.country}</span>
              <Button variant="ghost" size="sm" onClick={() => remove(h.id)}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-[--loss] shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <Tabs defaultValue="news">
        <TabsList className="h-9 p-1 bg-muted">
          <TabsTrigger value="news"     className="h-7 text-xs">News Events</TabsTrigger>
          <TabsTrigger value="holidays" className="h-7 text-xs">Bank Holidays</TabsTrigger>
        </TabsList>
        <TabsContent value="news"     className="mt-4"><NewsTab /></TabsContent>
        <TabsContent value="holidays" className="mt-4"><HolidaysTab /></TabsContent>
      </Tabs>
    </div>
  );
}
