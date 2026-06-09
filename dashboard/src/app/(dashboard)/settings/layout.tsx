"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { Users, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const SETTINGS_TABS = [
  { href: "/settings/users",  icon: Users,  label: "Users",            permission: PERMISSIONS.USERS_VIEW },
  { href: "/settings/roles",  icon: Shield, label: "Roles & Permissions", permission: PERMISSIONS.ROLES_VIEW },
] as const;

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { can } = usePermissions();

  const visibleTabs = SETTINGS_TABS.filter((t) => can(t.permission));

  return (
    <div className="space-y-6">
      {/* Tab nav */}
      <div className="flex gap-1 border-b border-border">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
