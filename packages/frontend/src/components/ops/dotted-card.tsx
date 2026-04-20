import { cn } from "@/lib/utils";
import * as React from "react";

// Ops Console card: 2px dotted border, cream background, optional uppercase header strip.
// Used as the visual shell for every dashboard widget.
interface DottedCardProps extends React.HTMLAttributes<HTMLDivElement> {
  header?: React.ReactNode;
  actions?: React.ReactNode;
  compact?: boolean;
}

export function DottedCard({
  header,
  actions,
  compact,
  className,
  children,
  ...rest
}: DottedCardProps) {
  return (
    <div
      {...rest}
      className={cn(
        "border-dotted-2 bg-card text-card-foreground rounded-sm",
        compact ? "p-3" : "p-4",
        className,
      )}
    >
      {(header || actions) && (
        <div className="flex items-center justify-between mb-3 gap-3">
          {typeof header === "string" ? (
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              {header}
            </span>
          ) : (
            header
          )}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
