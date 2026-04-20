import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { RefreshCw, PhoneCall, Headphones } from 'lucide-react';
import { toast } from 'sonner';
import { SectionHeader } from '@/components/ops/section-header';
import { DottedCard } from '@/components/ops/dotted-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import api from '@/services/api-client';
import { cn } from '@/lib/utils';
import { StatsBar } from '@/components/monitoring/stats-bar';
import { PillFilters, StatusFilter } from '@/components/monitoring/pill-filters';
import { TeamSection } from '@/components/monitoring/team-section';
import { AgentCardData } from '@/components/monitoring/agent-card';
import { formatSec } from '@/components/monitoring/status-meta';

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
  callerNumber: string;
  destNumber: string;
  duration: number;
  agentExtension: string;
  agentName: string;
  direction: string;
}

type EnrichedAgent = AgentCardData & {
  teamId: string | null;
  teamName: string | null;
  teamLeader: string | null;
};

export default function LiveDashboardPage() {
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [lastUpdated, setLastUpdated] = useState(Date.now());

  const { data: agents, refetch: refetchAgents, isFetching } = useQuery({
    queryKey: ['monitoring-agents'],
    queryFn: async () => {
      const { data: resp } = await api.get('/monitoring/agents');
      return resp.data as AgentMonitor[];
    },
    refetchInterval: 5000,
  });

  const { data: calls, refetch: refetchCalls } = useQuery({
    queryKey: ['monitoring-calls'],
    queryFn: async () => {
      const { data: resp } = await api.get('/monitoring/active-calls');
      return resp.data as ActiveCall[];
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

  // Merge agent status with active-call data — agent is on_call iff an active call matches their ext.
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
        teamId: a.teamId,
        teamName: a.teamName,
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

  const filtered = filter === 'all' ? enriched : enriched.filter((a) => a.status === filter);

  const { teamGroups, unassigned } = useMemo(() => {
    const map = new Map<string, { name: string; leader: string | null; agents: EnrichedAgent[] }>();
    const un: EnrichedAgent[] = [];
    for (const a of filtered) {
      if (!a.teamId) { un.push(a); continue; }
      const key = a.teamId;
      if (!map.has(key)) map.set(key, { name: a.teamName || 'Team', leader: a.teamLeader, agents: [] });
      map.get(key)!.agents.push(a);
    }
    const teamGroups = [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    return { teamGroups, unassigned: un };
  }, [filtered]);

  const handleWhisper = (extension: string) => {
    const call = (calls || []).find((c) => c.agentExtension === extension);
    if (call) whisperMutation.mutate(call.uuid);
  };

  const updatedStr = new Date(lastUpdated).toLocaleTimeString('vi-VN', { hour12: false });

  const actions = (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500">
        Cập nhật lần cuối: <span className="font-mono">{updatedStr}</span>
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
      <SectionHeader label="Giám sát trực tiếp" actions={actions} />

      <motion.div
        key={lastUpdated}
        initial={{ scaleX: 0, opacity: 0.8 }}
        animate={{ scaleX: 1, opacity: 0 }}
        transition={{ duration: 1.2 }}
        className="h-0.5 w-full origin-left"
        style={{ background: 'linear-gradient(to right, var(--color-status-ok), var(--color-status-ok))' }}
      />

      <StatsBar
        ready={counts.online}
        onCall={counts.on_call}
        onBreak={counts.break}
        offline={counts.offline}
        total={counts.all}
      />

      <PillFilters value={filter} onChange={setFilter} counts={counts} />

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

      <DottedCard header="Cuộc gọi đang diễn ra">
        {(calls?.length || 0) === 0 ? (
          <p className="text-sm italic text-muted-foreground">Không có cuộc gọi nào</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                {['Nhân viên', 'Số gọi', 'Số nhận', 'Hướng', 'Thời lượng', 'Thao tác'].map((h) => (
                  <th key={h} className="p-3 text-left font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calls?.map((c) => (
                <tr key={c.uuid} className="border-t border-dashed">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <PhoneCall className="h-4 w-4 animate-pulse" style={{ color: 'var(--color-status-err)' }} />
                      {c.agentName || c.agentExtension}
                    </div>
                  </td>
                  <td className="p-3 font-mono text-xs">{c.callerNumber}</td>
                  <td className="p-3 font-mono text-xs">{c.destNumber}</td>
                  <td className="p-3">
                    <Badge variant={c.direction === 'inbound' ? 'default' : 'secondary'}>
                      {c.direction === 'inbound' ? 'Gọi vào' : 'Gọi ra'}
                    </Badge>
                  </td>
                  <td className="p-3 font-mono">{formatSec(c.duration)}</td>
                  <td className="p-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => whisperMutation.mutate(c.uuid)}
                      disabled={whisperMutation.isPending}
                      title="Nghe thầm"
                    >
                      <Headphones className="mr-1 h-4 w-4" />
                      Whisper
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DottedCard>
    </div>
  );
}
