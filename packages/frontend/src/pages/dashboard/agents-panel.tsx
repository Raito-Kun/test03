import { useQuery } from "@tanstack/react-query";
import { DottedCard } from "@/components/ops/dotted-card";
import { SectionHeader } from "@/components/ops/section-header";
import { Badge } from "@/components/ui/badge";
import { VI } from "@/lib/vi-text";
import api from "@/services/api-client";

interface AgentStatus {
  id: string;
  fullName: string;
  role: string;
  sipExtension?: string | null;
  currentStatus: { status: string; updatedAt: string | null };
}

const STATUS_DOT: Record<string, string> = {
  ready: "bg-emerald-500",
  on_call: "bg-blue-500",
  ringing: "bg-amber-400",
  break: "bg-orange-400",
  wrap_up: "bg-violet-500",
  offline: "bg-rose-500",
  hold: "bg-cyan-500",
  transfer: "bg-pink-500",
};

const STATUS_CHIP: Record<string, string> = {
  ready: "border-emerald-200 text-emerald-700 bg-emerald-50",
  on_call: "border-blue-200 text-blue-700 bg-blue-50",
  ringing: "border-amber-200 text-amber-700 bg-amber-50",
  break: "border-orange-200 text-orange-700 bg-orange-50",
  wrap_up: "border-violet-200 text-violet-700 bg-violet-50",
  offline: "border-rose-200 text-rose-700 bg-rose-50",
};

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}

function monogram(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(-2)
    .join("")
    .toUpperCase();
}

function AgentRow({ agent }: { agent: AgentStatus }) {
  const status = agent.currentStatus.status;
  const dot = STATUS_DOT[status] || "bg-slate-400";
  const chip = STATUS_CHIP[status] || "border-slate-200 text-slate-600 bg-slate-50";
  const label =
    VI.agentStatus[status as keyof typeof VI.agentStatus] || status;
  const elapsed = agent.currentStatus.updatedAt
    ? timeAgo(agent.currentStatus.updatedAt)
    : null;

  return (
    <div className="flex items-center gap-2.5 py-1.5 border-b border-border/40 last:border-0">
      {/* Avatar monogram */}
      <div className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
        <span className="font-mono text-[9px] font-bold">{monogram(agent.fullName)}</span>
      </div>
      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className="font-mono text-[11px] text-foreground truncate">{agent.fullName}</p>
        {agent.sipExtension && (
          <p className="font-mono text-[9px] text-muted-foreground">ext.{agent.sipExtension}</p>
        )}
      </div>
      {/* Status chip */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
        <Badge
          variant="outline"
          className={`font-mono text-[9px] px-1.5 py-0 h-4 ${chip}`}
        >
          {label}
        </Badge>
        {elapsed && (
          <span className="font-mono text-[9px] text-muted-foreground w-6 text-right">
            {elapsed}
          </span>
        )}
      </div>
    </div>
  );
}

export function AgentsPanel() {
  const { data: agents, isLoading } = useQuery({
    queryKey: ["dashboard-agents"],
    queryFn: () =>
      api
        .get<{ data: AgentStatus[] }>("/dashboard/agents")
        .then((r) => r.data.data),
    refetchInterval: 30_000,
  });

  const online = (agents ?? []).filter((a) => a.currentStatus.status !== "offline").length;
  const total = (agents ?? []).length;

  return (
    <DottedCard className="flex flex-col h-full min-h-[280px]">
      <SectionHeader
        label="Trạng thái agents"
        hint={`${online}/${total} · ext.101-399`}
        className="mb-3"
      />
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 bg-muted rounded animate-pulse" />
          ))}
        </div>
      ) : (agents ?? []).length === 0 ? (
        <p className="font-mono text-[11px] text-muted-foreground text-center py-6">
          Chưa có agent nào
        </p>
      ) : (
        <div className="overflow-y-auto max-h-60 pr-0.5" style={{ scrollbarWidth: "thin" }}>
          {(agents ?? []).map((a) => (
            <AgentRow key={a.id} agent={a} />
          ))}
        </div>
      )}
    </DottedCard>
  );
}
