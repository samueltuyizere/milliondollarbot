import { cn } from "@/lib/utils";

type Tone = "profit" | "loss" | "warning" | "neutral" | "gold";

const toneStyles: Record<Tone, string> = {
  profit:  "text-emerald-400",
  loss:    "text-red-400",
  warning: "text-amber-400",
  gold:    "text-[--gold]",
  neutral: "text-foreground",
};

// Subtle background + border tint for the card itself
const cardToneStyles: Record<Tone, string> = {
  profit:  "bg-emerald-500/[0.06] border-border",
  loss:    "bg-red-500/[0.06] border-border",
  warning: "bg-amber-500/[0.06] border-border",
  gold:    "bg-[--gold]/[0.06] border-border",
  neutral: "bg-card border-border",
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
      "rounded-lg border p-4 flex flex-col gap-2 min-w-0 transition-colors",
      cardToneStyles[tone],
      className
    )}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.08em] truncate">
          {label}
        </span>
        {icon && (
          <span className={cn("shrink-0 opacity-70", toneStyles[tone])}>
            {icon}
          </span>
        )}
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
