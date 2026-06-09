import { cn } from "@/lib/utils";
import { AlertTriangle, Info, CheckCircle2, XCircle } from "lucide-react";

type AlertTone = "info" | "success" | "warning" | "danger";

const toneConfig: Record<AlertTone, { icon: React.ElementType; style: string }> = {
  info:    { icon: Info,           style: "bg-blue-400/8 border-blue-400/20 text-blue-300" },
  success: { icon: CheckCircle2,   style: "bg-[--profit]/8 border-[--profit]/20 text-[--profit]" },
  warning: { icon: AlertTriangle,  style: "bg-amber-400/8 border-amber-400/20 text-amber-300" },
  danger:  { icon: XCircle,        style: "bg-[--loss]/8 border-[--loss]/20 text-[--loss]" },
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
