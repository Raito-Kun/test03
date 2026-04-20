import { useMemo } from "react";
import { DottedCard } from "@/components/ops/dotted-card";
import { SectionHeader } from "@/components/ops/section-header";

// Deterministic mock seeded by today's date — avoids hydration mismatch.
// Replace with real GET /dashboard/call-volume-24h when available.
function seedRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return Math.abs(s) / 0xffffffff;
  };
}

const MAX = 142;
const AVG = 53;
const ROWS = ["T1", "T2", "T3"] as const;

function buildMockData(dateKey: number) {
  const rng = seedRng(dateKey);
  return ROWS.map((label) => ({
    label,
    hours: Array.from({ length: 24 }, (_, h) => {
      // Shape: low nights, peak 8-11 and 14-17
      const base = h >= 8 && h <= 11 ? 0.6 : h >= 14 && h <= 17 ? 0.55 : h < 6 ? 0.05 : 0.25;
      return Math.round((base + rng() * 0.35) * MAX);
    }),
  }));
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function CallVolumeHeatmap() {
  const dateKey = useMemo(() => {
    const d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }, []);

  const rows = useMemo(() => buildMockData(dateKey), [dateKey]);

  return (
    <DottedCard>
      <div className="flex items-center justify-between mb-3">
        <SectionHeader
          label="Cuộc gọi 24h"
          hint={`hist/hour · max=${MAX} · avg=${AVG}`}
        />
        <span
          className="font-mono text-[9px] uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded-sm cursor-default"
          title="Dữ liệu mô phỏng — endpoint chưa triển khai"
        >
          MOCK
        </span>
      </div>

      {/* Hour axis */}
      <div className="flex gap-px mb-1 pl-6">
        {HOURS.map((h) => (
          <div key={h} className="flex-1 text-center font-mono text-[8px] text-muted-foreground/60">
            {h % 4 === 0 ? String(h).padStart(2, "0") : ""}
          </div>
        ))}
      </div>

      {/* Rows */}
      <div className="space-y-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-1">
            <span className="font-mono text-[9px] text-muted-foreground w-5 shrink-0 text-right">
              {row.label}
            </span>
            <div className="flex gap-px flex-1">
              {row.hours.map((val, h) => {
                const intensity = Math.min(1, val / MAX);
                const opacity = 0.08 + intensity * 0.85;
                return (
                  <div
                    key={h}
                    className="flex-1 h-5 rounded-[2px] bg-violet-500 transition-opacity"
                    style={{ opacity }}
                    title={`${String(h).padStart(2, "0")}:00 · ${val} cuộc`}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-2 justify-end">
        <span className="font-mono text-[9px] text-muted-foreground">0</span>
        <div className="flex gap-px">
          {[0.08, 0.25, 0.45, 0.65, 0.85, 0.93].map((o) => (
            <div key={o} className="w-3 h-2 rounded-[1px] bg-violet-500" style={{ opacity: o }} />
          ))}
        </div>
        <span className="font-mono text-[9px] text-muted-foreground">{MAX}</span>
      </div>
    </DottedCard>
  );
}
