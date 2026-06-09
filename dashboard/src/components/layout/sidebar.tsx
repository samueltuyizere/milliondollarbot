"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Calendar,
  ScrollText,
  TrendingUp,
  BarChart2,
  User,
  ChevronRight,
  PanelLeftClose,
  Users,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";

const ROUTE_NAV = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/trades",    icon: BarChart2,       label: "Trades" },
  { href: "/calendar",  icon: Calendar,        label: "Calendar" },
  { href: "/logs",      icon: ScrollText,      label: "Logs" },
];

const SETTINGS_NAV = [
  { href: "/settings/users",  icon: Users,  label: "Users",       permission: PERMISSIONS.USERS_VIEW },
  { href: "/settings/roles",  icon: Shield, label: "Roles",       permission: PERMISSIONS.ROLES_VIEW },
] as const;


interface SidebarProps {
  isOpen: boolean;
  collapsed: boolean;
  onClose: () => void;
  onCollapsedChange: (collapsed: boolean) => void;
}

function NavLinkItem({
  href,
  icon: Icon,
  label,
  active,
  collapsed,
  onClick,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
  collapsed: boolean;
  onClick?: () => void;
}) {
  return (
    <li className="my-0.5">
      <Link
        href={href}
        onClick={onClick}
        title={collapsed ? label : undefined}
        className={cn(
          "flex items-center gap-3 min-h-[44px] w-full text-left transition-all duration-200",
          collapsed ? "justify-center px-3 py-3" : "px-5 md:px-7 py-3",
          active
            ? "bg-sidebar-accent text-sidebar-foreground border-l-4 border-primary"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground border-l-4 border-transparent"
        )}
      >
        <Icon className={cn("shrink-0 w-[18px] h-[18px]", active && "text-primary")} />
        {!collapsed && (
          <span className="text-sm font-medium flex-1 truncate">{label}</span>
        )}
      </Link>
    </li>
  );
}


export function Sidebar({ isOpen, collapsed, onClose, onCollapsedChange }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { can } = usePermissions();

  const name =
    (session?.user as { name?: string })?.name ??
    session?.user?.email?.split("@")[0] ??
    "Trader";
  const email = session?.user?.email ?? "";
  const role = ((session?.user as { role?: string })?.role ?? "TRADER").toLowerCase();
  const roleLabel = role === "admin" ? "Administrator" : "Trader";
  const initials = name.slice(0, 2).toUpperCase();

  const handleCollapseToggle = () => {
    onCollapsedChange(!collapsed);
  };

  const handleLinkClick = () => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      onClose();
    }
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-40 lg:hidden min-h-dvh cursor-pointer"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 z-50 flex flex-col overflow-y-auto overflow-x-hidden",
          "h-full min-h-dvh transition-all duration-300 ease-in-out",
          "w-[280px] max-w-[85vw] lg:max-w-none lg:translate-x-0",
          "bg-sidebar border-r border-sidebar-border text-sidebar-foreground",
          isOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "lg:w-20" : "lg:w-64"
        )}
      >
        <div className="p-4 sm:p-5 border-b border-sidebar-border shrink-0 mb-2">
          <div className="relative flex items-center">
            <Link
              href="/dashboard"
              onClick={handleLinkClick}
              className={cn(
                "flex items-center gap-3 min-h-11 min-w-0",
                collapsed ? "w-full justify-center" : "flex-1"
              )}
            >
              <div
                className="relative shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(209,158,0,0.22), rgba(209,158,0,0.08))",
                  border: "1px solid rgba(209,158,0,0.28)",
                }}
              >
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              {!collapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="text-lg font-semibold leading-tight truncate">AITrader</span>
                  <span className="text-xs text-sidebar-foreground/60 leading-tight">
                    MillionDollarBot
                  </span>
                </div>
              )}
            </Link>

            <span className={cn("hidden lg:inline-flex", collapsed && "absolute right-0")}>
              <button
                type="button"
                onClick={handleCollapseToggle}
                className="p-2 min-w-11 min-h-11 flex items-center justify-center rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {collapsed ? (
                  <ChevronRight className="w-4 h-4" />
                ) : (
                  <PanelLeftClose className="w-4 h-4" />
                )}
              </button>
            </span>
          </div>
        </div>

        <div
          className={cn(
            "shrink-0 flex flex-col items-center gap-3 mb-2 p-4 sm:p-6",
            collapsed ? "lg:px-3" : ""
          )}
        >
          <div
            className={cn(
              "rounded-full flex items-center justify-center font-bold text-primary",
              "bg-black/25 border-2 border-primary/35 transition-all duration-300",
              "hover:bg-black/35 hover:border-primary/50",
              collapsed ? "w-12 h-12 text-xs lg:w-12 lg:h-12" : "w-20 h-20 sm:w-24 sm:h-24 text-lg"
            )}
          >
            {collapsed ? (
              <User className="w-5 h-5 text-primary/90" />
            ) : (
              <span suppressHydrationWarning>{initials}</span>
            )}
          </div>

          {!collapsed && (
            <div className="text-center w-full min-w-0">
              <p className="text-sm font-semibold truncate" suppressHydrationWarning>
                {name}
              </p>
              {email && (
                <p
                  className="text-xs text-sidebar-foreground/55 truncate max-w-[200px] mx-auto mt-0.5"
                  suppressHydrationWarning
                >
                  {email}
                </p>
              )}
              <p className="text-[10px] text-primary font-semibold uppercase tracking-[0.14em] mt-1.5">
                {roleLabel}
              </p>
              <p className="text-[10px] text-sidebar-foreground/45 mt-0.5">Phase 1 · $200k</p>
            </div>
          )}
        </div>

        <nav className="flex-1 py-0 overflow-y-auto min-h-0">
          {!collapsed && (
            <div className="px-5 md:px-7 pt-1 pb-1.5" role="presentation">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/40">
                Trading
              </span>
            </div>
          )}

          <ul className="list-none p-0 m-0 flex flex-col">
            {ROUTE_NAV.map((item) => (
              <NavLinkItem
                key={item.href}
                {...item}
                active={
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href))
                }
                collapsed={collapsed}
                onClick={handleLinkClick}
              />
            ))}
          </ul>

          {/* Settings section — only visible when user has at least one settings permission */}
          {SETTINGS_NAV.some((item) => can(item.permission)) && (
            <>
              {!collapsed && (
                <div className="px-5 md:px-7 pt-4 pb-1.5" role="presentation">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/40">
                    Settings
                  </span>
                </div>
              )}
              <ul className="list-none p-0 m-0 flex flex-col">
                {SETTINGS_NAV.filter((item) => can(item.permission)).map((item) => (
                  <NavLinkItem
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    label={item.label}
                    active={pathname.startsWith(item.href)}
                    collapsed={collapsed}
                    onClick={handleLinkClick}
                  />
                ))}
              </ul>
            </>
          )}
        </nav>
      </aside>
    </>
  );
}
