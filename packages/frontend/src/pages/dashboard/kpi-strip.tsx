import { KpiCell } from "@/components/ops/kpi-cell";
import { formatDuration } from "@/lib/format";
import type { OverviewData } from "@/hooks/use-dashboard-overview";

interface KpiStripProps {
  data: OverviewData | undefined;
  isLoading: boolean;
  sparklines: {
    total: number[];
    answered: number[];
    missed: number[];
    onCall: number[];
    duration: number[];
    rate: number[];
  };
}

export function KpiStrip({ data, isLoading, sparklines }: KpiStripProps) {
  const total = data?.calls.totalToday ?? 0;
  const answered = data?.calls.answeredToday ?? 0;
  const missed = total - answered;
  const onCall = data?.agents.onCall ?? 0;
  const avgSec = data?.calls.avgDuration;
  const avgLabel = avgSec !== undefined ? formatDuration(avgSec) : "0:00";

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border-dotted-2 bg-card rounded-sm p-3 h-28 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <KpiCell
        label="Tổng cuộc gọi"
        value={total.toLocaleString("vi-VN")}
        delta="—"
        deltaTone="neutral"
        sparkline={sparklines.total}
        tone="neutral"
      />
      <KpiCell
        label="Đã nghe"
        value={answered.toLocaleString("vi-VN")}
        unit="cuộc"
        delta="—"
        deltaTone="ok"
        sparkline={sparklines.answered}
        tone="ok"
      />
      <KpiCell
        label="Nhỡ"
        value={missed.toLocaleString("vi-VN")}
        delta="—"
        deltaTone="warn"
        sparkline={sparklines.missed}
        tone="warn"
      />
      <KpiCell
        label="Đang gọi"
        value={String(onCall).padStart(2, "0")}
        unit="live"
        delta="0%"
        deltaTone="neutral"
        sparkline={sparklines.onCall}
        tone="neutral"
      />
      <KpiCell
        label="Thời lượng TB"
        value={avgLabel}
        unit="phút"
        delta="—"
        deltaTone="neutral"
        sparkline={sparklines.duration}
        tone="neutral"
      />
      <KpiCell
        label="Uptime"
        value="100%"
        delta="0%"
        deltaTone="ok"
        sparkline={sparklines.rate}
        tone="ok"
      />
    </div>
  );
}
