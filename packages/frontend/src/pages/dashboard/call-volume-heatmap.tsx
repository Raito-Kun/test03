import { DottedCard } from "@/components/ops/dotted-card";
import { SectionHeader } from "@/components/ops/section-header";

// Call volume heatmap — 24 columns × 7 rows of rounded cells, intensity-tinted
// from accent/30 (low) to primary (high).
// Backend endpoint GET /dashboard/call-volume-24h is NOT implemented yet.
// Showing a static demo grid that matches the mockup's visual treatment.
// Wire real data when the endpoint lands.

const HOURS = Array.from({ length: 24 }, (_, i) => i);

// 7 rows × 24 cols — demo intensity values (0-4 scale, purely cosmetic)
// prettier-ignore
const DEMO_GRID: number[][] = [
  [0,0,0,0,0,0,1,1,2,3,3,4,3,3,4,3,2,2,1,1,0,0,0,0],
  [0,0,0,0,0,1,1,2,3,4,4,3,3,4,3,4,3,2,2,1,1,0,0,0],
  [0,0,0,0,1,1,2,3,3,4,3,3,4,3,3,3,2,2,1,1,0,0,0,0],
  [0,0,0,1,1,2,2,3,4,3,4,4,3,3,2,2,2,1,1,0,0,0,0,0],
  [0,0,0,0,0,1,2,2,3,3,4,3,3,3,3,2,2,1,1,0,0,0,0,0],
  [0,0,0,0,1,1,1,2,2,3,3,3,2,2,2,2,1,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,1,1,2,2,2,2,2,2,1,1,1,0,0,0,0,0,0,0],
];

// Map 0-4 intensity to Tailwind bg classes using M3 lavender palette tokens
const INTENSITY_CLASS: Record<number, string> = {
  0: "bg-accent/20",
  1: "bg-accent/50",
  2: "bg-primary/25",
  3: "bg-primary/55",
  4: "bg-primary",
};

// X-axis tick labels — 4 even ticks across 24 columns
const X_TICKS: { hour: number; label: string }[] = [
  { hour: 0,  label: "00:00" },
  { hour: 6,  label: "06:00" },
  { hour: 12, label: "12:00" },
  { hour: 18, label: "18:00" },
  { hour: 23, label: "23:59" },
];

function todayLabel(): string {
  return new Date().toLocaleDateString("vi-VN", {
    day: "numeric",
    month: "long",
  });
}

export function CallVolumeHeatmap() {
  return (
    <DottedCard>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <SectionHeader label="24h Call Volume" />
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground">
            Hôm nay, {todayLabel()}
          </span>
          <span
            className="font-mono text-[9px] uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded-sm cursor-default"
            title="Endpoint GET /dashboard/call-volume-24h chưa triển khai — hiển thị demo"
          >
            SẮP RA MẮT
          </span>
        </div>
      </div>

      {/* Heatmap grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[480px]">
          {/* Cell grid */}
          <div className="space-y-[3px]">
            {DEMO_GRID.map((row, rowIdx) => (
              <div key={rowIdx} className="flex gap-[3px]">
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className={`flex-1 h-5 rounded-[3px] transition-opacity hover:opacity-80 ${INTENSITY_CLASS[row[h] ?? 0]}`}
                    aria-hidden
                    title={`${String(h).padStart(2, "0")}:00`}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* X-axis labels */}
          <div className="relative mt-1.5 h-4">
            {X_TICKS.map(({ hour, label }) => (
              <span
                key={hour}
                className="absolute font-mono text-[9px] text-muted-foreground -translate-x-1/2"
                style={{ left: `${(hour / 23) * 100}%` }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Footer hint */}
      <p className="font-mono text-[10px] text-muted-foreground/60 mt-3 italic">
        Demo — endpoint GET /dashboard/call-volume-24h chưa triển khai
      </p>
    </DottedCard>
  );
}
