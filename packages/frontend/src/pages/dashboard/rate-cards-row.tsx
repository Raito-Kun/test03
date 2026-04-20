import { DottedCard } from "@/components/ops/dotted-card";
import type { OverviewData } from "@/hooks/use-dashboard-overview";

interface RateCardProps {
  label: string;
  value: number;
  target?: number;
  source?: string;
}

function RateCard({ label, value, target = 60, source }: RateCardProps) {
  const pct = Math.min(100, Math.max(0, value));
  const targetPct = Math.min(100, Math.max(0, target));
  const barColor =
    pct >= target ? "bg-violet-500" : pct >= target * 0.7 ? "bg-amber-400" : "bg-rose-400";

  return (
    <DottedCard compact className="flex flex-col gap-2">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-2xl font-semibold text-foreground leading-none">
          {pct}
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">%</span>
      </div>
      {/* Progress bar with target marker */}
      <div className="relative h-1.5 w-full bg-muted rounded-full overflow-visible">
        <div
          className={`h-full rounded-full ${barColor} transition-all`}
          style={{ width: `${pct}%` }}
        />
        {/* Target marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-px h-3 bg-foreground/30"
          style={{ left: `${targetPct}%` }}
          title={`Mục tiêu: ${targetPct}%`}
        />
      </div>
      {source && (
        <span className="font-mono text-[9px] text-muted-foreground/70 uppercase tracking-wider">
          {source}
        </span>
      )}
    </DottedCard>
  );
}

interface RateCardsRowProps {
  data: OverviewData | undefined;
  isLoading: boolean;
}

export function RateCardsRow({ data, isLoading }: RateCardsRowProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border-dotted-2 bg-card rounded-sm p-3 h-24 animate-pulse" />
        ))}
      </div>
    );
  }

  // Fallback to 0 (never to mockup's fake 81/23/54/36). API is cluster-scoped.
  const rates = [
    {
      label: "Tỷ lệ liên hệ",
      value: Math.round(data?.calls.answerRatePercent ?? 0),
      source: "calls/answer-rate",
    },
    {
      label: "Tỷ lệ chốt đơn",
      value: Math.round(data?.leads.closeRatePercent ?? 0),
      source: "leads/close-rate",
    },
    {
      label: "Tỷ lệ PTP",
      value: Math.round(data?.debtCases.ptpRatePercent ?? 0),
      source: "debt/ptp-rate",
    },
    {
      label: "Tỷ lệ thu hồi",
      value: Math.round(data?.debtCases.recoveryRatePercent ?? 0),
      source: "debt/recovery-rate",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {rates.map((r) => (
        <RateCard key={r.label} {...r} />
      ))}
    </div>
  );
}
