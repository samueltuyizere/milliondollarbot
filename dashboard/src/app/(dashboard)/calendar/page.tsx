"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Palmtree, RefreshCw, AlertTriangle, Info } from "lucide-react";
import { SectionHeader } from "@/components/ui/section-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

type NewsEvent = {
  id: string;
  title: string;
  currency: string;
  impact: string;
  eventTime: string;
  skipTrading: boolean;
  minutesBefore: number;
  minutesAfter: number;
};

type Holiday = {
  id: string;
  country: string;
  name: string;
  date: string;
  description?: string;
};

type FilterImpact = "ALL" | "HIGH" | "MEDIUM" | "LOW";

const IMPACT_CONFIG = {
  HIGH:   { label: "High",   bg: "bg-red-500/10",    border: "border-red-500/25",    text: "text-red-400",    badge: "bg-red-500/20 text-red-400" },
  MEDIUM: { label: "Medium", bg: "bg-amber-500/10",  border: "border-amber-500/25",  text: "text-amber-400",  badge: "bg-amber-500/20 text-amber-400" },
  LOW:    { label: "Low",    bg: "bg-muted/40",       border: "border-border",        text: "text-muted-foreground", badge: "bg-muted text-muted-foreground" },
};

function impactIcon(impact: string) {
  if (impact === "HIGH")   return <AlertTriangle className="w-3.5 h-3.5" />;
  if (impact === "MEDIUM") return <Info className="w-3.5 h-3.5" />;
  return null;
}

function groupByDay(events: NewsEvent[], holidays: Holiday[]) {
  const map: Record<string, { date: Date; news: NewsEvent[]; holidays: Holiday[] }> = {};

  for (const ev of events) {
    const d = new Date(ev.eventTime);
    const key = d.toISOString().slice(0, 10);
    if (!map[key]) map[key] = { date: new Date(key + "T00:00:00Z"), news: [], holidays: [] };
    map[key].news.push(ev);
  }
  for (const h of holidays) {
    const key = new Date(h.date).toISOString().slice(0, 10);
    if (!map[key]) map[key] = { date: new Date(key + "T00:00:00Z"), news: [], holidays: [] };
    map[key].holidays.push(h);
  }

  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
}

function DayLabel({ date }: { date: Date }) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const isToday    = date.toISOString().slice(0, 10) === today.toISOString().slice(0, 10);
  const isTomorrow = date.toISOString().slice(0, 10) === tomorrow.toISOString().slice(0, 10);

  const label = isToday ? "Today" : isTomorrow ? "Tomorrow" : date.toLocaleDateString([], { weekday: "long" });
  const sub   = date.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="flex items-center gap-3 mb-3">
      <div className={cn(
        "flex flex-col items-center justify-center w-12 h-12 rounded-lg border shrink-0",
        isToday ? "bg-primary/10 border-primary/30" : "bg-card border-border"
      )}>
        <span className={cn("text-[10px] font-bold uppercase tracking-wide", isToday ? "text-primary" : "text-muted-foreground")}>
          {date.toLocaleDateString([], { month: "short" })}
        </span>
        <span className={cn("text-lg font-bold leading-tight", isToday ? "text-primary" : "text-foreground")}>
          {date.getUTCDate()}
        </span>
      </div>
      <div>
        <p className={cn("text-sm font-semibold", isToday && "text-primary")}>{label}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const [news, setNews]     = useState<NewsEvent[]>([]);
  const [holidays, setHols] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<FilterImpact>("ALL");
  const [lastSync, setLastSync] = useState<Date | null>(null);

  async function load() {
    setLoading(true);
    try {
      // Fetch next 7 days by calling the API twice (48h) — we'll expand the API
      const res = await fetch("/api/events?days=7");
      const data = await res.json();
      setNews(data.newsEvents ?? []);
      setHols(data.holidays ?? []);
      setLastSync(new Date());
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filteredNews = filter === "ALL" ? news : news.filter((e) => e.impact === filter);
  const groups = groupByDay(filteredNews, holidays);

  const counts = {
    HIGH:   news.filter((e) => e.impact === "HIGH").length,
    MEDIUM: news.filter((e) => e.impact === "MEDIUM").length,
    LOW:    news.filter((e) => e.impact === "LOW").length,
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Economic Calendar"
        description="Upcoming news events and bank holidays affecting XAUUSD trading."
        action={
          <Button variant="ghost" size="sm" onClick={load} className="h-7 text-xs gap-1.5" disabled={loading}>
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            {lastSync ? `Synced ${lastSync.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Refresh"}
          </Button>
        }
      />

      {/* Impact filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["ALL", "HIGH", "MEDIUM", "LOW"] as FilterImpact[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-semibold transition-colors border",
              filter === f
                ? "bg-primary/10 border-primary/40 text-primary"
                : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-border/80"
            )}
          >
            {f === "ALL" ? `All (${news.length})` : f === "HIGH" ? `High (${counts.HIGH})` : f === "MEDIUM" ? `Medium (${counts.MEDIUM})` : `Low (${counts.LOW})`}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> High — trading blocked ±30 min</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Medium — monitor only</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-300 inline-block" /> Holiday — trading blocked all day</span>
      </div>

      {/* Events grouped by day */}
      {loading ? (
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2 animate-pulse">
              <div className="h-12 w-48 rounded-lg bg-muted" />
              <div className="h-14 rounded-lg bg-muted" />
              <div className="h-14 rounded-lg bg-muted" />
            </div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="w-8 h-8" />}
          title="No upcoming events"
          description="No high or medium impact events found for the next 7 days. The bot will trade normally."
        />
      ) : (
        <div className="space-y-8">
          {groups.map(([key, { date, news: dayNews, holidays: dayHols }]) => (
            <div key={key}>
              <DayLabel date={date} />
              <div className="space-y-2 ml-0 lg:ml-16">
                {/* Bank holidays first */}
                {dayHols.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-500/[0.06] border border-amber-500/20"
                  >
                    <Palmtree className="w-4 h-4 text-amber-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-amber-300">{h.name}</p>
                      {h.description && h.description !== h.name && (
                        <p className="text-xs text-muted-foreground">{h.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-semibold bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">
                        {h.country === "GB" ? "🇬🇧 UK" : "🇺🇸 US"} Holiday
                      </span>
                      <span className="text-xs text-red-400 font-medium">Trading blocked</span>
                    </div>
                  </div>
                ))}

                {/* News events */}
                {dayNews.map((ev) => {
                  const cfg = IMPACT_CONFIG[ev.impact as keyof typeof IMPACT_CONFIG] ?? IMPACT_CONFIG.LOW;
                  const time = new Date(ev.eventTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
                  const localTime = new Date(ev.eventTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                  return (
                    <div
                      key={ev.id}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-lg border",
                        cfg.bg, cfg.border
                      )}
                    >
                      <div className="flex flex-col items-center w-12 shrink-0 text-center">
                        <span className="text-xs font-mono font-semibold text-foreground">{localTime}</span>
                        <span className="text-[10px] text-muted-foreground">{time} UTC</span>
                      </div>
                      <div className={cn("w-px h-8 rounded-full shrink-0", ev.impact === "HIGH" ? "bg-red-500/40" : "bg-amber-500/30")} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-snug truncate">{ev.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{ev.currency}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                        <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded", cfg.badge)}>
                          {impactIcon(ev.impact)}
                          {cfg.label}
                        </span>
                        {ev.skipTrading && (
                          <span className="text-xs text-red-400 font-medium whitespace-nowrap">
                            blocked ±{ev.minutesBefore}m
                          </span>
                        )}
                        {!ev.skipTrading && (
                          <span className="text-xs text-muted-foreground whitespace-nowrap">monitor only</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
