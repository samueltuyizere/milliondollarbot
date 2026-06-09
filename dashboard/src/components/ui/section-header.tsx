import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export function SectionHeader({ title, description, children, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3 mb-3", className)}>
      <div className="flex items-baseline gap-2">
        <h2 className="text-[13px] font-semibold tracking-tight text-foreground">{title}</h2>
        {description && (
          <span className="text-xs text-muted-foreground font-normal">{description}</span>
        )}
      </div>
      {children}
    </div>
  );
}
