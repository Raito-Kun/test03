import { cn } from "@/lib/utils";

// Fixed bottom DOS/htop-style status bar. Each cell is a label + value pair
// rendered in monospace. Consumers pass an array of cells; no internal state.
export interface StatusCell {
  label: string;
  value: React.ReactNode;
  tone?: "neutral" | "ok" | "warn" | "err";
  mono?: boolean;
}

interface StatusBarProps {
  left?: React.ReactNode;
  cells: StatusCell[];
  right?: React.ReactNode;
  className?: string;
}

const TONE_DOT: Record<NonNullable<StatusCell["tone"]>, string> = {
  neutral: "bg-muted-foreground",
  ok: "bg-[var(--color-status-ok)]",
  warn: "bg-[var(--color-status-warn)]",
  err: "bg-[var(--color-status-err)]",
};

export function StatusBar({ left, cells, right, className }: StatusBarProps) {
  return (
    <div
      className={cn(
        "fixed bottom-0 inset-x-0 z-30 h-7 flex items-center",
        "bg-[var(--color-indigo-deep)] text-white/80 font-mono text-[10.5px]",
        "border-t border-white/10 px-3 gap-4 overflow-x-auto scrollbar-hide",
        className,
      )}
    >
      {left && <div className="flex items-center gap-2 shrink-0">{left}</div>}
      <div className="flex items-center gap-4 min-w-0 flex-1">
        {cells.map((cell, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 shrink-0 whitespace-nowrap"
          >
            {cell.tone && (
              <span className={cn("w-1.5 h-1.5 rounded-full", TONE_DOT[cell.tone])} />
            )}
            <span className="uppercase tracking-wider text-white/50">
              {cell.label}
            </span>
            <span className={cn(cell.mono !== false && "font-mono")}>
              {cell.value}
            </span>
          </div>
        ))}
      </div>
      {right && <div className="flex items-center gap-2 shrink-0">{right}</div>}
    </div>
  );
}
