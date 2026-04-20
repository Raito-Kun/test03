import { DottedCard } from "@/components/ops/dotted-card";
import { SectionHeader } from "@/components/ops/section-header";

// Call volume heatmap placeholder.
// Backend endpoint GET /dashboard/call-volume-24h is NOT implemented yet.
// Showing a disabled skeleton so the layout stays intact but no fake
// per-tenant data is displayed. Wire real data when the endpoint lands.
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const ROWS = ["T1", "T2", "T3"] as const;

export function CallVolumeHeatmap() {
  return (
    <DottedCard>
      <div className="flex items-center justify-between mb-3">
        <SectionHeader
          label="Cuộc gọi 24h"
          hint="hist/hour · chờ dữ liệu thật"
        />
        <span
          className="font-mono text-[9px] uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded-sm cursor-default"
          title="Endpoint GET /dashboard/call-volume-24h chưa triển khai"
        >
          COMING SOON
        </span>
      </div>

      {/* Hour axis (kept for visual scale) */}
      <div className="flex gap-px mb-1 pl-6">
        {HOURS.map((h) => (
          <div key={h} className="flex-1 text-center font-mono text-[8px] text-muted-foreground/60">
            {h % 4 === 0 ? String(h).padStart(2, "0") : ""}
          </div>
        ))}
      </div>

      {/* Empty row skeletons */}
      <div className="space-y-1">
        {ROWS.map((label) => (
          <div key={label} className="flex items-center gap-1">
            <span className="font-mono text-[9px] text-muted-foreground w-5 shrink-0 text-right">
              {label}
            </span>
            <div className="flex gap-px flex-1">
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="flex-1 h-5 rounded-[2px] bg-muted/60"
                  aria-hidden
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="font-mono text-[10px] text-muted-foreground/70 mt-3 italic">
        Chưa có API tổng hợp 24h. Dashboard đang dùng KPI realtime thay thế.
      </p>
    </DottedCard>
  );
}
