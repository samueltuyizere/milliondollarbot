import { cn } from "@/lib/utils";

interface ChartPanelProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  legend?: React.ReactNode;
}

export function ChartPanel({
  title,
  subtitle,
  children,
  className,
  legend,
}: ChartPanelProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4 sm:p-5 flex flex-col min-h-[280px]",
        className
      )}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2 shrink-0">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
        {legend}
      </div>
      <div className="flex-1 min-h-[220px]">{children}</div>
    </div>
  );
}

export function EmptyChart({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-[220px] items-center justify-center text-sm text-muted-foreground text-center px-4",
        className
      )}
    >
      {children}
    </div>
  );
}
