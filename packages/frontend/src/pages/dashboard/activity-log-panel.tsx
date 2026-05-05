import { useRef, useEffect } from "react";
import { DottedCard } from "@/components/ops/dotted-card";
import { SectionHeader } from "@/components/ops/section-header";
import { useActivityLog, type ActivityTone } from "@/hooks/use-activity-log";

// Tone → colored dot mapping (soft colored dot before each entry)
const TONE_DOT: Record<ActivityTone, string> = {
  violet: "bg-violet-500",
  orange: "bg-orange-400",
  red: "bg-rose-500",
  green: "bg-emerald-500",
  gray: "bg-muted-foreground/60",
};

// Tone → icon background (pill behind the dot for visual weight)
const TONE_ICON_BG: Record<ActivityTone, string> = {
  violet: "bg-violet-100",
  orange: "bg-orange-100",
  red: "bg-rose-100",
  green: "bg-emerald-100",
  gray: "bg-muted",
};

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function ActivityLogPanel() {
  const entries = useActivityLog();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top (newest first)
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [entries.length]);

  return (
    <DottedCard className="flex flex-col h-full min-h-[280px]">
      <SectionHeader
        label="Recent Activity"
        hint="tail -f events.log"
        className="mb-3"
      />

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-1 pr-1 max-h-[280px]"
        style={{ scrollbarWidth: "thin" }}
      >
        {entries.map((e) => (
          <div
            key={e.id}
            className="flex items-start gap-2.5 py-1.5 border-b border-dashed border-border/40 last:border-0 group"
          >
            {/* Colored icon dot pill */}
            <div
              className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${TONE_ICON_BG[e.tone]}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${TONE_DOT[e.tone]}`} />
            </div>

            {/* Text block */}
            <div className="flex-1 min-w-0">
              <p className="font-mono text-[11px] text-foreground truncate leading-snug">
                {e.text}
              </p>
              {e.sub && (
                <p className="font-mono text-[10px] text-muted-foreground/70 truncate">
                  {e.sub}
                </p>
              )}
            </div>

            {/* Timestamp — mono, right-aligned */}
            <span className="font-mono text-[10px] text-muted-foreground shrink-0 tabular-nums">
              {fmtTime(e.timestamp)}
            </span>
          </div>
        ))}

        {entries.length === 0 && (
          <p className="font-mono text-[11px] text-muted-foreground text-center py-6 italic">
            Chưa có sự kiện nào...
          </p>
        )}
      </div>
    </DottedCard>
  );
}
