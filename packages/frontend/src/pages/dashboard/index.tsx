import { useDashboardOverview } from "@/hooks/use-dashboard-overview";
import { DashboardHeader } from "./dashboard-header";
import { KpiStrip } from "./kpi-strip";
import { RateCardsRow } from "./rate-cards-row";
import { ActivityLogPanel } from "./activity-log-panel";
import { AgentsPanel } from "./agents-panel";
import { InlineDialerPanel } from "./inline-dialer-panel";
import { CallVolumeHeatmap } from "./call-volume-heatmap";

function todayLabel(): string {
  return new Date().toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function DashboardPage() {
  const { data, isLoading, sparklines } = useDashboardOverview();

  return (
    <div className="space-y-4 pb-6">
      {/* 1. Header strip — branding chips + cluster status + actions */}
      <DashboardHeader sessionDate={todayLabel()} />

      {/* 2. KPI strip — 6 cards (3 primary + 3 secondary) */}
      <KpiStrip data={data} isLoading={isLoading} sparklines={sparklines} />

      {/* 3. Rate cards — 4 progress bars */}
      <RateCardsRow data={data} isLoading={isLoading} />

      {/* 4. 24h Call Volume heatmap — full width */}
      <CallVolumeHeatmap />

      {/* 5. Bottom row: 2-col (agents + activity) + dialer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Nhân viên trực tuyến */}
        <AgentsPanel />
        {/* Recent Activity */}
        <ActivityLogPanel />
        {/* Inline dialer */}
        <InlineDialerPanel />
      </div>
    </div>
  );
}
