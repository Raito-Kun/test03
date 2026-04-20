import { useRef, useEffect } from "react";
import { DottedCard } from "@/components/ops/dotted-card";
import { SectionHeader } from "@/components/ops/section-header";
import { useActivityLog, type ActivityTone } from "@/hooks/use-activity-log";

const TONE_DOT: Record<ActivityTone, string> = {
  violet: "bg-violet-500",
  orange: "bg-orange-400",
  red: "bg-rose-500",
  green: "bg-emerald-500",
  gray: "bg-slate-400",
};

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
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
        label="Hoạt động hệ thống"
        hint="tail -f events.log · auto-scroll"
        className="mb-3"
      />
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-60"
        style={{ scrollbarWidth: "thin" }}
      >
        {entries.map((e) => (
          <div key={e.id} className="flex items-start gap-2 group">
            <span
              className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${TONE_DOT[e.tone]}`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                  {fmtTime(e.timestamp)}
                </span>
                <span className="font-mono text-[11px] text-foreground truncate">
                  {e.text}
                </span>
              </div>
              {e.sub && (
                <span className="font-mono text-[10px] text-muted-foreground/70">
                  {e.sub}
                </span>
              )}
            </div>
          </div>
        ))}
        {entries.length === 0 && (
          <p className="font-mono text-[11px] text-muted-foreground text-center py-4">
            Chưa có sự kiện nào...
          </p>
        )}
      </div>
    </DottedCard>
  );
}
