import { cn } from "@/lib/utils";

type Tone = "profit" | "loss" | "warning" | "neutral" | "gold";

const toneStyles: Record<Tone, string> = {
  profit:  "text-[--profit]",
  loss:    "text-[--loss]",
  warning: "text-amber-400",
  gold:    "text-[--gold]",
  neutral: "text-foreground",
};

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({ label, value, sub, tone = "neutral", icon, className }: StatCardProps) {
  return (
    <div className={cn(
      "rounded-lg border border-border bg-card p-4 flex flex-col gap-2 min-w-0",
      className
    )}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em] truncate">
          {label}
        </span>
        {icon && <span className="text-muted-foreground/60 shrink-0">{icon}</span>}
      </div>
      <div className="space-y-0.5">
        <p className={cn("text-2xl font-semibold price truncate", toneStyles[tone])}>
          {value}
        </p>
        {sub && <p className="text-xs text-muted-foreground tabular">{sub}</p>}
      </div>
    </div>
  );
}
