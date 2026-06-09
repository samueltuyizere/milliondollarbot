import { cn } from "@/lib/utils";

interface FieldRowProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

export function FieldRow({ label, hint, children, className }: FieldRowProps) {
  return (
    <div className={cn("grid grid-cols-[1fr_1fr] gap-4 items-start py-3 border-b border-border/50 last:border-0", className)}>
      <div className="pt-0.5">
        <p className="text-[13px] font-medium tracking-tight">{label}</p>
        {hint && <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{hint}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}
