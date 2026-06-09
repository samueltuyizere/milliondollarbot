"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ChevronDown, LogOut, User, Settings2, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_TITLES: Record<string, { title: string; description?: string }> = {
  "/dashboard":  { title: "Dashboard",      description: "Overview & live P&L" },
  "/bot":        { title: "Bot Control",    description: "Start, stop & monitor" },
  "/config":     { title: "Configuration",  description: "Risk rules & strategy" },
  "/calendar":   { title: "Calendar",       description: "News & bank holidays" },
  "/logs":       { title: "Logs",           description: "System, trades & audit" },
};

// ─── Bot status indicator fetched from the API ─────────────────────────────

function BotStatusPill() {
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const r = await fetch("/api/bot/status");
        const d = await r.json();
        setStatus(d.status?.status ?? null);
      } catch {}
    }
    fetchStatus();
    const id = setInterval(fetchStatus, 6000);
    return () => clearInterval(id);
  }, []);

  if (!status) return null;

  const config: Record<string, { dot: string; label: string; text: string }> = {
    RUNNING:    { dot: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]", label: "animate-pulse", text: "text-emerald-400" },
    PAUSED:     { dot: "bg-amber-400",   label: "",               text: "text-amber-400" },
    STOPPED:    { dot: "bg-muted-foreground/40", label: "",       text: "text-muted-foreground/60" },
    DAILY_LOCK: { dot: "bg-red-400",     label: "",               text: "text-red-400" },
    ERROR:      { dot: "bg-red-400",     label: "",               text: "text-red-400" },
  };

  const c = config[status] ?? config.STOPPED;

  return (
    <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-muted/40">
      <span className={cn("w-1.5 h-1.5 rounded-full", c.dot, c.label)} />
      <span className={cn("text-[11px] font-medium uppercase tracking-wider", c.text)}>
        {status === "DAILY_LOCK" ? "LOCKED" : status}
      </span>
    </div>
  );
}

// ─── Header ─────────────────────────────────────────────────────────────────

export function Header() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const page = PAGE_TITLES[pathname] ?? { title: "AITrader" };
  const name = (session?.user as any)?.name ?? session?.user?.email?.split("@")[0] ?? "Trader";
  const initials = name.slice(0, 2).toUpperCase();

  // Close dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-40 bg-card border-b border-border h-14 flex items-center px-4 md:px-6 gap-4 shrink-0">

      {/* Mobile spacer for hamburger */}
      <div className="w-8 md:hidden" />

      {/* Page title */}
      <div className="flex-1 min-w-0">
        <h2 className="text-[14px] font-semibold tracking-tight truncate leading-none">
          {page.title}
        </h2>
        {page.description && (
          <p className="text-[11px] text-muted-foreground/60 mt-0.5 hidden sm:block">
            {page.description}
          </p>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 shrink-0">

        {/* Bot status pill */}
        <BotStatusPill />

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="flex items-center gap-2 pl-2 pr-1.5 py-1.5 rounded-lg hover:bg-muted/60 transition-colors"
          >
            {/* Avatar */}
            <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center">
              <span className="text-[10px] font-bold text-primary">{initials}</span>
            </div>
            <span className="text-[12px] font-medium hidden sm:block max-w-[100px] truncate">{name}</span>
            <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform duration-150", menuOpen && "rotate-180")} />
          </button>

          {/* Dropdown */}
          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-popover border border-border rounded-lg shadow-lg z-50 py-1 overflow-hidden">
              {/* User info header */}
              <div className="px-3 py-2.5 border-b border-border">
                <p className="text-[12px] font-medium truncate">{name}</p>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {session?.user?.email}
                </p>
              </div>

              <div className="py-1">
                <Link
                  href="/config"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  Configuration
                </Link>
                <Link
                  href="/logs"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                >
                  <Activity className="w-3.5 h-3.5" />
                  Logs
                </Link>
              </div>

              <div className="border-t border-border py-1">
                <Link
                  href="/api/auth/signout"
                  className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-muted-foreground hover:text-red-400 hover:bg-red-400/8 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign out
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
