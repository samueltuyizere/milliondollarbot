import { cn } from "@/lib/utils";

type BotMode = "mock" | "live" | null | undefined;

interface BotModeBadgeProps {
  mode: BotMode;
  className?: string;
  size?: "sm" | "md";
}

export function BotModeBadge({ mode, className, size = "sm" }: BotModeBadgeProps) {
  if (!mode) return null;

  const isMock = mode === "mock";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border font-semibold uppercase tracking-wider shrink-0",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]",
        isMock
          ? "border-amber-500/40 bg-amber-500/12 text-amber-700 dark:border-amber-400/35 dark:bg-amber-400/10 dark:text-amber-400"
          : "border-emerald-500/40 bg-emerald-500/12 text-emerald-700 dark:border-emerald-400/35 dark:bg-emerald-400/10 dark:text-emerald-400",
        className
      )}
      title={
        isMock
          ? "Mock bot — simulated trades only, no real broker orders"
          : "Live bot — connected to MetaTrader 5"
      }
    >
      {isMock ? "Simulation" : "Live MT5"}
    </span>
  );
}
