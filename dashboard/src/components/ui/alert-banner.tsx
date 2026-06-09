import { cn } from "@/lib/utils";
import { AlertTriangle, Info, CheckCircle2, XCircle } from "lucide-react";

type AlertTone = "info" | "success" | "warning" | "danger";

const toneConfig: Record<AlertTone, { icon: React.ElementType; style: string }> = {
  info:    { icon: Info,           style: "bg-blue-500/10 border-blue-500/25 text-blue-700 dark:bg-blue-400/8 dark:border-blue-400/20 dark:text-blue-300" },
  success: { icon: CheckCircle2,   style: "bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:bg-emerald-400/8 dark:border-emerald-400/20 dark:text-emerald-300" },
  warning: { icon: AlertTriangle,  style: "bg-amber-500/12 border-amber-500/30 text-amber-700 dark:bg-amber-400/8 dark:border-amber-400/20 dark:text-amber-300" },
  danger:  { icon: XCircle,        style: "bg-red-500/10 border-red-500/25 text-red-700 dark:bg-red-400/8 dark:border-red-400/20 dark:text-red-300" },
};

interface AlertBannerProps {
  tone: AlertTone;
  title: string;
  description?: string;
  className?: string;
}

export function AlertBanner({ tone, title, description, className }: AlertBannerProps) {
  const cfg = toneConfig[tone];
  const Icon = cfg.icon;
  return (
    <div className={cn("flex items-start gap-3 rounded-lg border px-4 py-3", cfg.style, className)}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="text-xs opacity-80">{description}</p>}
      </div>
    </div>
  );
}
