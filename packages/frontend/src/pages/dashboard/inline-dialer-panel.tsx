import { useState, useCallback } from "react";
import { DottedCard } from "@/components/ops/dotted-card";
import { SectionHeader } from "@/components/ops/section-header";
import { ClickToCallButton } from "@/components/click-to-call-button";

const RECENT: { num: string; info: string; ok: boolean }[] = [
  { num: "0981 234 567", info: "2:14", ok: true },
  { num: "0909 876 543", info: "— FAIL", ok: false },
  { num: "0933 111 222", info: "5:02", ok: true },
];

const KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["*", "0", "#"],
];

export function InlineDialerPanel() {
  const [phone, setPhone] = useState("");

  const press = useCallback((k: string) => {
    setPhone((p) => (p.length < 15 ? p + k : p));
  }, []);

  const del = useCallback(() => {
    setPhone((p) => p.slice(0, -1));
  }, []);

  return (
    <DottedCard className="flex flex-col h-full min-h-[280px]">
      <SectionHeader
        label="Gọi nhanh (eyebeam)"
        hint="sip/ext.102"
        className="mb-3"
      />

      {/* Terminal prompt */}
      <div className="font-mono text-[11px] text-muted-foreground mb-1">&gt; dial_</div>

      {/* Phone input display */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 border border-border rounded-sm px-2 py-1.5 font-mono text-sm text-foreground bg-background min-h-[32px] tracking-wider">
          {phone || <span className="text-muted-foreground/40">0981····</span>}
        </div>
        {phone && (
          <button
            onClick={del}
            className="font-mono text-[11px] text-muted-foreground hover:text-foreground px-1"
            aria-label="Xóa"
          >
            ⌫
          </button>
        )}
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-1 mb-3">
        {KEYS.flat().map((k) => (
          <button
            key={k}
            onClick={() => press(k)}
            className="font-mono text-sm h-8 rounded-sm border border-border bg-muted/40 hover:bg-muted transition-colors text-foreground"
          >
            {k}
          </button>
        ))}
      </div>

      {/* Call button */}
      <div className="mb-3">
        <ClickToCallButton
          phone={phone}
          contactName={phone}
          size="sm"
          variant="default"
        />
      </div>

      {/* Recent calls */}
      <div className="mt-auto">
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
          GẦN ĐÂY
        </p>
        <div className="space-y-1">
          {RECENT.map((r) => (
            <button
              key={r.num}
              onClick={() => setPhone(r.num.replace(/\s/g, ""))}
              className="w-full flex items-center justify-between px-2 py-1 rounded-sm hover:bg-muted/60 transition-colors group"
            >
              <span className="font-mono text-[11px] text-foreground group-hover:text-violet-600">
                {r.num}
              </span>
              <span
                className={`font-mono text-[10px] ${r.ok ? "text-muted-foreground" : "text-rose-500"}`}
              >
                {r.info}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Shortcuts hint */}
      <div className="mt-2 flex gap-2 flex-wrap">
        {["Enter → Gọi", "Esc → Xóa", "Del → Sửa"].map((hint) => (
          <span key={hint} className="font-mono text-[9px] text-muted-foreground/60 border border-border/40 px-1 rounded-sm">
            {hint}
          </span>
        ))}
      </div>
    </DottedCard>
  );
}
