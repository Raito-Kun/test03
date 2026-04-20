import { cn } from "@/lib/utils";

// Uppercase monospace section label with an optional trailing hint (e.g. counts
// "8/8", file reference "tail -f events.log") and inline actions.
interface SectionHeaderProps {
  label: string;
  hint?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function SectionHeader({
  label,
  hint,
  actions,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <div className="flex items-center gap-2 min-w-0">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground/85">
          {label}
        </h2>
        {hint && (
          <span className="text-xs text-muted-foreground truncate">
            {hint}
          </span>
        )}
      </div>
      {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
    </div>
  );
}
