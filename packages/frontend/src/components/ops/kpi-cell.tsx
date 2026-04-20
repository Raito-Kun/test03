import { cn } from "@/lib/utils";
import { Sparkline } from "./sparkline";
import { DottedCard } from "./dotted-card";

// KPI cell used in the dashboard's top strip: uppercase label, big mono value,
// optional delta chip (e.g. "+12.4% vs HÔM QUA"), and a sparkline underneath.
export type KpiTone = "neutral" | "ok" | "warn" | "err";

interface KpiCellProps {
  label: string;
  value: string | number;
  unit?: string;
  delta?: string;
  deltaTone?: KpiTone;
  sparkline?: number[];
  tone?: KpiTone;
  className?: string;
}

const TONE_STROKE: Record<KpiTone, string> = {
  neutral: "stroke-primary",
  ok: "stroke-[var(--color-status-ok)]",
  warn: "stroke-[var(--color-status-warn)]",
  err: "stroke-[var(--color-status-err)]",
};

const TONE_TEXT: Record<KpiTone, string> = {
  neutral: "text-muted-foreground",
  ok: "text-[var(--color-status-ok)]",
  warn: "text-[var(--color-status-warn)]",
  err: "text-[var(--color-status-err)]",
};

export function KpiCell({
  label,
  value,
  unit,
  delta,
  deltaTone = "neutral",
  sparkline,
  tone = "neutral",
  className,
}: KpiCellProps) {
  return (
    <DottedCard compact className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <span className={cn("w-1.5 h-1.5 rounded-full bg-current", TONE_TEXT[tone])} />
        <span>{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-3xl font-semibold text-foreground leading-none">
          {value}
        </span>
        {unit && (
          <span className="font-mono text-[11px] uppercase text-muted-foreground">
            {unit}
          </span>
        )}
      </div>
      {delta && (
        <span className={cn("font-mono text-[10px] uppercase", TONE_TEXT[deltaTone])}>
          {delta}
        </span>
      )}
      {sparkline && sparkline.length > 0 && (
        <Sparkline
          values={sparkline}
          height={28}
          strokeClassName={TONE_STROKE[tone]}
          fillClassName={TONE_STROKE[tone].replace("stroke-", "fill-")}
          className="mt-auto"
        />
      )}
    </DottedCard>
  );
}
