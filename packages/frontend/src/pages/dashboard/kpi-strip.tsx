import { Phone, CheckCircle, Clock, Users, Timer, TrendingUp } from "lucide-react";
import { Sparkline } from "@/components/ops/sparkline";
import { DottedCard } from "@/components/ops/dotted-card";
import { formatDuration } from "@/lib/format";
import type { OverviewData } from "@/hooks/use-dashboard-overview";
import { cn } from "@/lib/utils";

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

type KpiTone = "primary" | "ok" | "warn" | "neutral";

interface KpiCardProps {
  label: string;
  value: string;
  unit?: string;
  icon: React.ReactNode;
  sparkline: number[];
  tone?: KpiTone;
  className?: string;
}

const TONE_DOT: Record<KpiTone, string> = {
  primary: "bg-primary",
  ok: "bg-[var(--color-status-ok)]",
  warn: "bg-[var(--color-status-warn)]",
  neutral: "bg-muted-foreground/50",
};

const TONE_STROKE: Record<KpiTone, string> = {
  primary: "stroke-primary",
  ok: "stroke-[var(--color-status-ok)]",
  warn: "stroke-[var(--color-status-warn)]",
  neutral: "stroke-muted-foreground/40",
};

const TONE_FILL: Record<KpiTone, string> = {
  primary: "fill-primary",
  ok: "fill-[var(--color-status-ok)]",
  warn: "fill-[var(--color-status-warn)]",
  neutral: "fill-muted-foreground",
};

const TONE_ICON: Record<KpiTone, string> = {
  primary: "text-primary/70",
  ok: "text-[var(--color-status-ok)]/70",
  warn: "text-[var(--color-status-warn)]/70",
  neutral: "text-muted-foreground/50",
};

function KpiCard({ label, value, unit, icon, sparkline, tone = "primary", className }: KpiCardProps) {
  return (
    <DottedCard compact className={cn("flex flex-col gap-1.5 min-h-[110px]", className)}>
      {/* Label row */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5">
          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", TONE_DOT[tone])} />
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
        </div>
        <span className={cn("shrink-0", TONE_ICON[tone])}>{icon}</span>
      </div>

      {/* Value row */}
      <div className="flex items-baseline gap-1">
        <span className="font-mono text-3xl font-semibold text-foreground leading-none tabular-nums">
          {value}
        </span>
        {unit && (
          <span className="font-mono text-xs text-muted-foreground uppercase">{unit}</span>
        )}
      </div>

      {/* Sparkline — fills remaining space */}
      {sparkline.length >= 2 ? (
        <Sparkline
          values={sparkline}
          height={32}
          strokeClassName={TONE_STROKE[tone]}
          fillClassName={TONE_FILL[tone]}
          className="mt-auto w-full"
        />
      ) : (
        <div className="mt-auto h-8 border-b border-dashed border-border/40" />
      )}
    </DottedCard>
  );
}

export function KpiStrip({ data, isLoading, sparklines }: KpiStripProps) {
  const total = data?.calls.totalToday ?? 0;
  const answered = data?.calls.answeredToday ?? 0;
  const missed = total - answered;
  const onCall = data?.agents.onCall ?? 0;
  const avgSec = data?.calls.avgDuration;
  const avgLabel = avgSec !== undefined ? formatDuration(avgSec) : "0:00";
  const answerRate = data?.calls.answerRatePercent ?? 0;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border-dotted-2 bg-card rounded-sm p-3 h-[110px] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {/* Primary 3 KPIs — match mockup: Cuộc gọi hôm nay / Tỷ lệ trả lời / Cuộc gọi đang chờ */}
      <KpiCard
        label="Cuộc gọi hôm nay"
        value={total.toLocaleString("vi-VN")}
        icon={<Phone className="h-3.5 w-3.5" />}
        sparkline={sparklines.total}
        tone="primary"
      />
      <KpiCard
        label="Tỷ lệ trả lời"
        value={`${answerRate}%`}
        icon={<CheckCircle className="h-3.5 w-3.5" />}
        sparkline={sparklines.rate}
        tone="ok"
      />
      <KpiCard
        label="Cuộc gọi đang chờ"
        value={String(onCall).padStart(2, "0")}
        icon={<Clock className="h-3.5 w-3.5" />}
        sparkline={sparklines.onCall}
        tone="warn"
      />

      {/* Secondary KPIs */}
      <KpiCard
        label="Đã nghe"
        value={answered.toLocaleString("vi-VN")}
        unit="cuộc"
        icon={<Users className="h-3.5 w-3.5" />}
        sparkline={sparklines.answered}
        tone="ok"
      />
      <KpiCard
        label="Thời lượng TB"
        value={avgLabel}
        unit="phút"
        icon={<Timer className="h-3.5 w-3.5" />}
        sparkline={sparklines.duration}
        tone="neutral"
      />
      <KpiCard
        label="Nhỡ"
        value={missed.toLocaleString("vi-VN")}
        icon={<TrendingUp className="h-3.5 w-3.5" />}
        sparkline={sparklines.missed}
        tone="warn"
      />
    </div>
  );
}
