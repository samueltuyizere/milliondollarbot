"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import {
  Menu,
  ChevronDown,
  LogOut,
  User,
  Settings2,
  Activity,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useModals } from "@/context/modal-context";
import { BotModeBadge } from "@/components/ui/bot-mode-badge";
import { PriceTicker } from "@/components/layout/price-ticker";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import type { BotMode } from "@/types";

const PAGE_TITLES: Record<string, { title: string; description?: string }> = {
  "/dashboard": { title: "Dashboard",    description: "Overview & live P&L" },
  "/trades":    { title: "Trades",       description: "Full trade history & open positions" },
  "/calendar":  { title: "Calendar",    description: "News & bank holidays" },
  "/logs":      { title: "Logs",         description: "System, trades & audit" },
};

interface HeaderProps {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  onMenuToggle: () => void;
}

function BotStatusPill({ onClick }: { onClick: () => void }) {
  const [status, setStatus] = useState<string | null>(null);
  const [botMode, setBotMode] = useState<BotMode | null>(null);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const r = await fetch("/api/bot/status");
        const d = await r.json();
        setStatus(d.status?.status ?? null);
        setBotMode(d.status?.botMode ?? null);
      } catch {}
    }
    fetchStatus();
    const id = setInterval(fetchStatus, 6000);
    return () => clearInterval(id);
  }, []);

  if (!status) return null;

  const config: Record<string, { dot: string; pulse?: boolean; text: string }> = {
    RUNNING: { dot: "bg-emerald-400", pulse: true, text: "text-emerald-400" },
    PAUSED: { dot: "bg-amber-400", text: "text-amber-400" },
    STOPPED: { dot: "bg-muted-foreground/40", text: "text-muted-foreground/70" },
    DAILY_LOCK: { dot: "bg-red-400", text: "text-red-400" },
    ERROR: { dot: "bg-red-400", text: "text-red-400" },
  };

  const c = config[status] ?? config.STOPPED;

  return (
    <div className="hidden sm:flex items-center gap-2">
      <BotModeBadge mode={botMode} />
      <button
        type="button"
        onClick={onClick}
        title="Open bot control"
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <span
          className={cn(
            "w-2 h-2 rounded-full shrink-0",
            c.dot,
            c.pulse && "shadow-[0_0_8px_rgba(52,211,153,0.6)] animate-pulse"
          )}
        />
        <span className={cn("text-[11px] font-semibold uppercase tracking-wider", c.text)}>
          {status === "DAILY_LOCK" ? "Locked" : status}
        </span>
      </button>
    </div>
  );
}

export function Header({ onMenuToggle }: HeaderProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { openModal } = useModals();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const page = PAGE_TITLES[pathname] ?? { title: "AITrader" };
  const name =
    (session?.user as { name?: string })?.name ??
    session?.user?.email?.split("@")[0] ??
    "Trader";
  const role = ((session?.user as { role?: string })?.role ?? "TRADER").toLowerCase();
  const roleLabel = role === "admin" ? "Administrator" : "Trader";

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
    <header className="sticky top-0 z-40 bg-card border-b border-border safe-area-inset shrink-0">
      <div className="flex flex-wrap items-center min-h-14 sm:min-h-16 lg:min-h-[72px] px-3 sm:px-4 md:px-6 lg:px-8 gap-2 sm:gap-4">
        <button
          type="button"
          onClick={onMenuToggle}
          className="flex lg:hidden items-center justify-center min-w-11 min-h-11 p-2.5 rounded-lg border border-border bg-muted/40 text-foreground hover:bg-muted hover:border-primary/30 transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="text-base sm:text-lg font-semibold tracking-tight truncate leading-tight m-0">
            {page.title}
          </h1>
          {page.description && (
            <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block m-0">
              {page.description}
            </p>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3 shrink-0">
          <PriceTicker />
          <ThemeToggle />
          <BotStatusPill onClick={() => openModal("bot")} />

          <div className="relative flex items-center gap-2 sm:gap-3" ref={menuRef}>
            <div className="hidden sm:block text-right">
              <p
                className="text-sm font-semibold leading-tight m-0 truncate max-w-[140px]"
                suppressHydrationWarning
              >
                {name}
              </p>
              <p className="text-xs text-muted-foreground leading-tight m-0 capitalize">
                {roleLabel}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2 min-w-11 min-h-11 p-1.5 rounded-lg hover:bg-muted/60 transition-colors"
              aria-label="User menu"
              aria-expanded={menuOpen}
            >
              <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-primary" />
              </div>
              <ChevronDown
                className={cn(
                  "hidden sm:block w-4 h-4 text-muted-foreground transition-transform",
                  menuOpen && "rotate-180"
                )}
              />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 min-w-[200px] max-w-[calc(100vw-2rem)] bg-popover border border-border rounded-xl shadow-lg z-50 py-1 overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-sm font-semibold truncate m-0" suppressHydrationWarning>
                    {name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5 m-0">
                    {session?.user?.email}
                  </p>
                  <p className="text-[10px] text-primary font-medium uppercase tracking-wide mt-1.5 m-0">
                    {roleLabel}
                  </p>
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      openModal("bot");
                      setMenuOpen(false);
                    }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <Bot className="w-4 h-4" />
                    Bot Control
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      openModal("config");
                      setMenuOpen(false);
                    }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <Settings2 className="w-4 h-4" />
                    Configuration
                  </button>
                  <Link
                    href="/logs"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <Activity className="w-4 h-4" />
                    Logs
                  </Link>
                </div>

                <div className="border-t border-border py-1">
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-400/10 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
