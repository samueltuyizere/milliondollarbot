"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  Settings2,
  Calendar,
  ScrollText,
  TrendingUp,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  User,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/bot",       icon: Bot,             label: "Bot Control" },
  { href: "/config",    icon: Settings2,        label: "Configuration" },
  { href: "/calendar",  icon: Calendar,         label: "Calendar" },
  { href: "/logs",      icon: ScrollText,       label: "Logs" },
];

// ─── Nav item ──────────────────────────────────────────────────────────────

function NavItem({
  href, icon: Icon, label, active, collapsed, onClick,
}: {
  href: string; icon: React.ElementType; label: string;
  active: boolean; collapsed: boolean; onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-md transition-all duration-150",
        collapsed ? "justify-center px-0 py-2.5 mx-1" : "px-3 py-2.5 mx-0",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
      )}
    >
      {/* Active left-border accent */}
      {active && !collapsed && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-primary" />
      )}
      <Icon
        className={cn(
          "shrink-0 transition-colors",
          collapsed ? "w-[18px] h-[18px]" : "w-4 h-4",
          active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
        )}
      />
      {!collapsed && (
        <span className={cn("text-[13px] truncate", active ? "font-medium tracking-tight" : "font-normal")}>
          {label}
        </span>
      )}
    </Link>
  );
}

// ─── Sidebar content ────────────────────────────────────────────────────────

function SidebarContent({
  pathname,
  collapsed,
  onToggleCollapse,
  onNavClick,
}: {
  pathname: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onNavClick?: () => void;
}) {
  const { data: session } = useSession();
  const name = (session?.user as any)?.name ?? session?.user?.email?.split("@")[0] ?? "Trader";
  const email = session?.user?.email ?? "";

  return (
    <div className="flex flex-col h-full">

      {/* ── Logo / wordmark ── */}
      <div className={cn(
        "flex items-center border-b border-border h-14 shrink-0",
        collapsed ? "justify-center px-2" : "px-4 gap-2.5"
      )}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: "linear-gradient(135deg, rgba(209,158,0,0.2), rgba(209,158,0,0.07))",
            border: "1px solid rgba(209,158,0,0.25)",
          }}
        >
          <TrendingUp className="w-4 h-4 text-amber-400" />
        </div>
        {!collapsed && (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold tracking-[-0.03em] leading-none">AITrader</p>
              <p className="text-[9px] text-muted-foreground/60 mt-0.5 font-mono tracking-widest uppercase">XAUUSD</p>
            </div>
            <button
              onClick={onToggleCollapse}
              className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
              title="Collapse sidebar"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </>
        )}
        {collapsed && (
          <button
            onClick={onToggleCollapse}
            className="absolute bottom-20 -right-3 w-6 h-6 flex items-center justify-center rounded-full bg-card border border-border text-muted-foreground hover:text-foreground shadow-sm transition-colors z-10"
            title="Expand sidebar"
            suppressHydrationWarning
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className={cn("flex-1 py-2 overflow-y-auto", collapsed ? "px-0" : "px-2")}>
        <div className="space-y-0.5">
          {NAV.map(item => (
            <NavItem
              key={item.href}
              {...item}
              active={pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))}
              collapsed={collapsed}
              onClick={onNavClick}
            />
          ))}
        </div>
      </nav>

      {/* ── User + footer ── */}
      <div className={cn("border-t border-border py-2 shrink-0", collapsed ? "px-0" : "px-2")}>
        {/* User info */}
        {!collapsed && (
          <div className="flex items-center gap-2.5 px-3 py-2 mb-1 rounded-md">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium leading-none truncate" suppressHydrationWarning>{name}</p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate" suppressHydrationWarning>{email}</p>
            </div>
          </div>
        )}

        {/* Phase indicator */}
        {!collapsed && (
          <div className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-muted-foreground/50 mb-0.5">
            <Shield className="w-3.5 h-3.5 shrink-0" />
            <span>FundedNext · Phase 1</span>
          </div>
        )}

        {/* Sign out */}
        <Link
          href="/api/auth/signout"
          title={collapsed ? "Sign out" : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-md text-[13px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors",
            collapsed ? "justify-center px-0 py-2.5 mx-1" : "px-3 py-2"
          )}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </Link>
      </div>
    </div>
  );
}

// ─── Sidebar export ─────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Persist collapse state
  useEffect(() => {
    const saved = localStorage.getItem("aitrader_sidebar_collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  function toggleCollapse() {
    setCollapsed(prev => {
      localStorage.setItem("aitrader_sidebar_collapsed", String(!prev));
      return !prev;
    });
  }

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside
        className={cn(
          "hidden md:flex flex-col shrink-0 border-r border-border bg-sidebar h-screen sticky top-0 transition-all duration-200 relative",
          collapsed ? "w-[64px]" : "w-[220px]"
        )}
      >
        <SidebarContent
          pathname={pathname}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
        />
      </aside>

      {/* ── Mobile hamburger ── */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3.5 left-3.5 z-50 w-8 h-8 flex items-center justify-center rounded-md bg-card border border-border text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Open navigation"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <aside
            className="relative w-[220px] bg-sidebar border-r border-border h-full flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <SidebarContent
              pathname={pathname}
              collapsed={false}
              onToggleCollapse={() => {}}
              onNavClick={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}
    </>
  );
}
