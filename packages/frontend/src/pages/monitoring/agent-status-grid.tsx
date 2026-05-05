/* agent-status-grid v2 — M3 lavender alignment */
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Search, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { SectionHeader } from '@/components/ops/section-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import api from '@/services/api-client';
import { StatsBar } from '@/components/monitoring/stats-bar';
import { TeamSection } from '@/components/monitoring/team-section';
import { AgentCardData } from '@/components/monitoring/agent-card';
import type { StatusFilter } from '@/components/monitoring/pill-filters';

interface AgentMonitor {
  id: string;
  fullName: string;
  extension: string;
  registered: boolean;
  status: string;
  teamId: string | null;
  teamName: string | null;
  teamLeader: string | null;
}

interface ActiveCall {
  uuid: string;
  agentExtension: string;
  duration: number;
}

type EnrichedAgent = AgentCardData & {
  teamKey: string;
  teamName: string;
  teamLeader: string | null;
};

/** Segment chip options matching M3 lavender filter style */
const SEGMENT_OPTIONS: { key: StatusFilter; label: string; activeCls: string }[] = [
  { key: 'all',     label: 'Tất cả',     activeCls: 'bg-primary text-white border-primary' },
  { key: 'online',  label: 'Trực tuyến', activeCls: 'bg-emerald-600 text-white border-emerald-600' },
  { key: 'on_call', label: 'Đang gọi',   activeCls: 'bg-amber-500  text-white border-amber-500' },
  { key: 'break',   label: 'Vắng mặt',  activeCls: 'bg-slate-500  text-white border-slate-500' },
  { key: 'offline', label: 'Offline',    activeCls: 'bg-rose-500   text-white border-rose-500' },
];

export default function AgentStatusGridPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [lastUpdated, setLastUpdated] = useState(Date.now());

  const { data: agents, refetch: refetchAgents, isFetching } = useQuery({
    queryKey: ['monitoring-agent-status'],
    queryFn: async () => {
      const { data: resp } = await api.get('/monitoring/agents');
      return (resp.data ?? []) as AgentMonitor[];
    },
    refetchInterval: 5000,
  });

  const { data: calls, refetch: refetchCalls } = useQuery({
    queryKey: ['monitoring-active-calls'],
    queryFn: async () => {
      const { data: resp } = await api.get('/monitoring/active-calls');
      return (resp.data ?? []) as ActiveCall[];
    },
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (!isFetching) setLastUpdated(Date.now());
  }, [agents, calls, isFetching]);

  const whisperMutation = useMutation({
    mutationFn: async (callUuid: string) => {
      await api.post('/monitoring/whisper', { callUuid });
    },
    onSuccess: () => toast.success('Đã bắt đầu nghe thầm'),
    onError: (err: Error) => toast.error(`Lỗi: ${err.message}`),
  });

  const { enriched, counts } = useMemo(() => {
    const callByExt = new Map((calls || []).map((c) => [c.agentExtension, c]));
    const out: EnrichedAgent[] = [];
    const c: Record<StatusFilter, number> = { all: 0, online: 0, on_call: 0, break: 0, offline: 0 };
    for (const a of agents || []) {
      const active = callByExt.get(a.extension);
      const status = active ? 'on_call' : a.status;
      out.push({
        id: a.id,
        fullName: a.fullName,
        extension: a.extension,
        status,
        callDurationSec: active?.duration,
        teamKey: a.teamId || '__unassigned__',
        teamName: a.teamName || 'Chưa phân team',
        teamLeader: a.teamLeader,
      });
      c.all++;
      if (status === 'online') c.online++;
      else if (status === 'on_call') c.on_call++;
      else if (status === 'break') c.break++;
      else c.offline++;
    }
    return { enriched: out, counts: c };
  }, [agents, calls]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((a) => {
      if (filter !== 'all' && a.status !== filter) return false;
      if (q && !a.fullName.toLowerCase().includes(q) && !a.extension.includes(q)) return false;
      return true;
    });
  }, [enriched, search, filter]);

  const { teamGroups, unassigned } = useMemo(() => {
    const map = new Map<string, { name: string; leader: string | null; agents: EnrichedAgent[] }>();
    const un: EnrichedAgent[] = [];
    for (const a of filtered) {
      if (a.teamKey === '__unassigned__') { un.push(a); continue; }
      if (!map.has(a.teamKey)) map.set(a.teamKey, { name: a.teamName, leader: a.teamLeader, agents: [] });
      map.get(a.teamKey)!.agents.push(a);
    }
    const teamGroups = [...map.values()].sort((x, y) => x.name.localeCompare(y.name, 'vi'));
    return { teamGroups, unassigned: un };
  }, [filtered]);

  const handleWhisper = (extension: string) => {
    const call = (calls || []).find((c) => c.agentExtension === extension);
    if (call) whisperMutation.mutate(call.uuid);
  };

  const updatedStr = new Date(lastUpdated).toLocaleTimeString('vi-VN', { hour12: false });

  const actions = (
    <div className="flex items-center gap-3">
      <span className="hidden sm:inline text-xs text-muted-foreground">
        Cập nhật: <span className="font-mono">{updatedStr}</span>
      </span>
      <Button
        variant="outline"
        size="icon"
        onClick={() => { refetchAgents(); refetchCalls(); }}
        title="Làm mới"
      >
        <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="text-xs text-muted-foreground font-mono">
        <span>Trang chủ</span>
        <span className="mx-1.5 opacity-50">/</span>
        <span className="text-foreground">Trạng thái Agent</span>
      </div>

      <SectionHeader label="Trạng thái Agent" actions={actions} />

      {/* Live sweep line */}
      <motion.div
        key={lastUpdated}
        initial={{ scaleX: 0, opacity: 0.8 }}
        animate={{ scaleX: 1, opacity: 0 }}
        transition={{ duration: 1.2 }}
        className="h-0.5 w-full origin-left bg-primary"
      />

      <StatsBar
        ready={counts.online}
        onCall={counts.on_call}
        onBreak={counts.break}
        offline={counts.offline}
        total={counts.all}
      />

      {/* Filter row: search + segment chips */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search input */}
        <div className="relative min-w-[220px] flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên hoặc số máy..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-8"
          />
        </div>

        {/* Segment chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {SEGMENT_OPTIONS.map((opt) => {
            const active = filter === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setFilter(opt.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all',
                  active
                    ? opt.activeCls
                    : 'border-border bg-card text-muted-foreground hover:border-primary hover:text-primary',
                )}
              >
                {opt.label}
                <span className={cn(
                  'inline-flex min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums',
                  active ? 'bg-white/25' : 'bg-muted',
                )}>
                  {counts[opt.key] ?? 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {teamGroups.length === 0 && unassigned.length === 0 ? (
        <p className="py-10 text-center text-sm italic text-muted-foreground">
          Không có nhân viên nào phù hợp.
        </p>
      ) : (
        <>
          {teamGroups.map((t, i) => (
            <TeamSection
              key={`${t.name}-${i}`}
              name={t.name}
              leader={t.leader}
              agents={t.agents}
              onWhisper={handleWhisper}
              canWhisper
            />
          ))}
          {unassigned.length > 0 && (
            <TeamSection
              name="Chưa phân team"
              leader={null}
              agents={unassigned}
              onWhisper={handleWhisper}
              canWhisper
              muted
              defaultOpen={false}
            />
          )}
        </>
      )}
    </div>
  );
}
