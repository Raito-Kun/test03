/* team-stats v2 — M3 lavender alignment */
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { SectionHeader } from '@/components/ops/section-header';
import { cn } from '@/lib/utils';
import api from '@/services/api-client';

interface Team {
  id: string;
  name: string;
  type: string;
  leader: { fullName: string } | null;
  _count: { members: number };
}

interface Agent {
  id: string;
  fullName: string;
  extension: string;
  status: string;
  teamId: string | null;
  teamName: string | null;
}

/** Hero KPI card — same style as report dashboard */
function KpiCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className={cn(
      'rounded-md border border-border bg-card p-4',
      'transition-all hover:shadow-sm',
    )}>
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{label}</p>
      <p className={cn('text-3xl font-bold tabular-nums leading-none', accent ?? 'text-foreground')}>{value}</p>
      {sub && <p className="font-mono text-[10px] text-muted-foreground mt-1.5">{sub}</p>}
    </div>
  );
}

/** Agent ranking row inside a team */
function AgentRankRow({ rank, agent }: { rank: number; agent: Agent }) {
  const ini = agent.fullName.split(' ').filter(Boolean).slice(-2).map((w) => w[0].toUpperCase()).join('');
  const statusLabel: Record<string, string> = { online: 'Trực tuyến', on_call: 'Đang gọi', break: 'Vắng mặt', offline: 'Offline' };
  const statusCls: Record<string, string> = {
    online:  'text-emerald-600',
    on_call: 'text-amber-600',
    break:   'text-slate-500',
    offline: 'text-rose-500',
  };
  return (
    <tr className="border-t border-dashed border-border hover:bg-muted/30 transition-colors">
      <td className="px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground tabular-nums w-5 inline-block text-center">{rank}</span>
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-accent text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
            {ini}
          </div>
          <span className="text-sm">{agent.fullName}</span>
        </div>
      </td>
      <td className="px-4 py-2.5">
        <span className="font-mono text-[10px] text-muted-foreground">Ext: {agent.extension || '—'}</span>
      </td>
      <td className="px-4 py-2.5">
        <span className={cn('font-mono text-xs font-medium', statusCls[agent.status] ?? 'text-muted-foreground')}>
          {statusLabel[agent.status] ?? agent.status}
        </span>
      </td>
    </tr>
  );
}

export default function TeamStatsPage() {
  const [selectedTeam, setSelectedTeam] = useState<string>('all');

  const { data: teamsResp, isLoading: teamsLoading } = useQuery<{ data: Team[] }>({
    queryKey: ['teams'],
    queryFn: () => api.get('/teams?limit=100').then((r) => r.data),
  });

  const { data: agents = [], isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ['monitoring-agent-status'],
    queryFn: () => api.get('/monitoring/agents').then((r) => r.data.data ?? []),
    refetchInterval: 30000,
  });

  const teams = teamsResp?.data ?? [];
  const isLoading = teamsLoading || agentsLoading;

  const teamStats = useMemo(() => {
    return teams.map((team) => {
      const teamAgents = agents.filter((a) => a.teamId === team.id);
      const total = team._count?.members ?? 0;
      const online = teamAgents.filter((a) => a.status === 'online').length;
      const onCall = teamAgents.filter((a) => a.status === 'on_call').length;
      const offline = teamAgents.filter((a) => a.status === 'offline').length;
      const answerRate = total > 0 ? Math.round(((online + onCall) / total) * 100) : 0;
      return { teamId: team.id, teamName: team.name, leaderName: team.leader?.fullName ?? null, totalAgents: total, online, onCall, offline, answerRate, agents: teamAgents };
    });
  }, [teams, agents]);

  const unassigned = agents.filter((a) => !a.teamId);
  const filtered = selectedTeam === 'all' ? teamStats : teamStats.filter((s) => s.teamId === selectedTeam);

  const teamChips = (
    <div className="flex items-center gap-2 flex-wrap">
      {[{ id: 'all', name: 'Tất cả team' }, ...teams.map((t) => ({ id: t.id, name: t.name }))].map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => setSelectedTeam(opt.id)}
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-medium transition-all',
            selectedTeam === opt.id
              ? 'bg-primary text-white border-primary'
              : 'border-border bg-card text-muted-foreground hover:border-primary hover:text-primary',
          )}
        >
          {opt.name}
        </button>
      ))}
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-xs text-muted-foreground font-mono">
          <span>Trang chủ</span><span className="mx-1.5 opacity-50">/</span><span className="text-foreground">Thống kê theo Team</span>
        </div>
        <SectionHeader label="Thống kê theo Team" />
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="text-xs text-muted-foreground font-mono">
        <span>Trang chủ</span><span className="mx-1.5 opacity-50">/</span><span className="text-foreground">Thống kê theo Team</span>
      </div>

      <SectionHeader label="Thống kê theo Team" />

      {/* Team chip selector */}
      {teamChips}

      {teams.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">
          Chưa có team nào. Tạo team trong Quản lý team.
        </p>
      ) : (
        <div className="space-y-8">
          {filtered.map((team) => (
            <div key={team.teamId} className="space-y-4">
              {/* Team heading */}
              <div className="flex items-center gap-2 pb-2 border-b border-dashed border-border">
                <span className="font-mono text-xs uppercase tracking-widest text-foreground/80 font-semibold">
                  {team.teamName}
                </span>
                {team.leaderName && (
                  <span className="font-mono text-[10px] text-muted-foreground">
                    — Trưởng nhóm: {team.leaderName}
                  </span>
                )}
              </div>

              {/* KPI strip — 4 hero cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Tổng thành viên" value={team.totalAgents} />
                <KpiCard
                  label="Tỷ lệ trực tuyến"
                  value={`${team.answerRate}%`}
                  sub={`${team.online + team.onCall}/${team.totalAgents} đang hoạt động`}
                  accent="text-primary"
                />
                <KpiCard label="Đang gọi" value={team.onCall} accent={team.onCall > 0 ? 'text-amber-600' : undefined} />
                <KpiCard label="Ngoại tuyến" value={team.offline} accent={team.offline > 0 ? 'text-rose-600' : undefined} />
              </div>

              {/* Agent ranking table */}
              {team.agents.length > 0 && (
                <div className="rounded-md border border-border bg-card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-dashed border-border bg-muted/30">
                        {['#', 'NHÂN VIÊN', 'EXT', 'TRẠNG THÁI'].map((h) => (
                          <th key={h} className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {team.agents.map((a, idx) => (
                        <AgentRankRow key={a.id} rank={idx + 1} agent={a} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}

          {/* Unassigned agents block */}
          {selectedTeam === 'all' && unassigned.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-dashed border-border">
                <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                  Chưa phân nhóm ({unassigned.length})
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Tổng" value={unassigned.length} />
                <KpiCard label="Trực tuyến" value={unassigned.filter((a) => a.status === 'online').length} />
                <KpiCard label="Đang gọi" value={unassigned.filter((a) => a.status === 'on_call').length} />
                <KpiCard label="Ngoại tuyến" value={unassigned.filter((a) => a.status === 'offline').length} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
