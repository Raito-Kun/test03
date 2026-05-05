import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { RefreshCw, Eye, Ear, LogOut, Filter, AlertCircle, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import api from '@/services/api-client';
import { cn } from '@/lib/utils';
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
  queueName?: string;
}

interface ActiveCall {
  uuid: string;
  callerNumber: string;
  destNumber: string;
  duration: number;
  agentExtension: string;
  agentName: string;
  direction: string;
  destinationLabel?: string;
  holdTime?: number;
  maxHoldTime?: number;
}

type Status = 'avail' | 'busy' | 'wrap' | 'dnd' | 'offline';

const STATUS_META: Record<Status, { label: string; chip: string; rail: string }> = {
  avail:   { label: 'AVAIL',   chip: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-400', rail: 'bg-emerald-500' },
  busy:    { label: 'BUSY',    chip: 'bg-amber-50   text-amber-700   dark:bg-amber-900/25   dark:text-amber-400',   rail: 'bg-amber-500' },
  wrap:    { label: 'WRAP',    chip: 'bg-blue-50    text-blue-700    dark:bg-blue-900/25    dark:text-blue-400',    rail: 'bg-blue-500' },
  dnd:     { label: 'DND',     chip: 'bg-red-50     text-red-700     dark:bg-red-900/25     dark:text-red-400',     rail: 'bg-red-500' },
  offline: { label: 'OFFLINE', chip: 'bg-muted      text-muted-foreground',                                          rail: 'bg-muted-foreground/40' },
};

function mapStatus(s: string, onCall: boolean): Status {
  if (onCall || s === 'on_call') return 'busy';
  if (s === 'online') return 'avail';
  if (s === 'wrap') return 'wrap';
  if (s === 'break') return 'wrap';
  if (s === 'dnd') return 'dnd';
  return 'offline';
}

function initials(name: string): string {
  return (name || '?').split(' ').map((n) => n[0]).filter(Boolean).slice(-2).join('').toUpperCase();
}

function formatHold(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

type StatusFilter = 'all' | 'active' | Status;

// 'active' = mọi agent không OFFLINE (online/busy/wrap/dnd)
const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  all: 'Tất cả',
  active: 'Đang hoạt động',
  avail: 'AVAIL',
  busy: 'BUSY',
  wrap: 'WRAP',
  dnd: 'DND',
  offline: 'OFFLINE',
};

const CLUSTER_FILTER_LABELS: Record<string, string> = {
  all: 'Tất cả',
  'prod-01': 'Production-01',
};

const MONITORING_TABS = [
  { label: 'Cuộc gọi trực tiếp', to: '/monitoring/live-calls' },
  { label: 'Trạng thái agent', to: '/monitoring/agent-status' },
  { label: 'Thống kê team', to: '/monitoring/team-stats' },
] as const;

export default function LiveDashboardPage() {
  const location = useLocation();
  const [filter, setFilter] = useState<StatusFilter>('active');
  const [teamFilter, setTeamFilter] = useState('all');
  const [clusterFilter, setClusterFilter] = useState('all');
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

  // Merge agent + active-call rows into uniform list with mapped status.
  const enriched = useMemo(() => {
    const callByExt = new Map((calls || []).map((c) => [c.agentExtension, c]));
    return (agents || []).map((a) => {
      const active = callByExt.get(a.extension);
      return {
        id: a.id,
        fullName: a.fullName,
        extension: a.extension,
        teamId: a.teamId,
        teamName: a.teamName,
        queueName: a.queueName,
        status: mapStatus(a.status, !!active),
        callDurationSec: active?.duration ?? 0,
      };
    });
  }, [agents, calls]);

  const filtered = useMemo(() => {
    return enriched.filter((a) => {
      // 'active' = ẩn OFFLINE; 'all' = giữ nguyên; còn lại lọc theo status cụ thể
      if (filter === 'active' && a.status === 'offline') return false;
      if (filter !== 'all' && filter !== 'active' && a.status !== filter) return false;
      if (teamFilter !== 'all' && a.teamId !== teamFilter) return false;
      return true;
    });
  }, [enriched, filter, teamFilter]);

  const counts = useMemo(() => ({
    avail: enriched.filter((a) => a.status === 'avail').length,
    busy:  enriched.filter((a) => a.status === 'busy').length,
    wrap:  enriched.filter((a) => a.status === 'wrap').length,
    dnd:   enriched.filter((a) => a.status === 'dnd').length,
    total: enriched.length,
  }), [enriched]);

  const teamOptions = useMemo(() => {
    const set = new Map<string, string>();
    for (const a of agents || []) if (a.teamId && a.teamName) set.set(a.teamId, a.teamName);
    return Array.from(set, ([id, name]) => ({ id, name }));
  }, [agents]);

  // Derived performance metrics — mocked where backend doesn't yet expose them.
  const callsLen = calls?.length ?? 0;
  const answerRate = counts.total > 0 ? Math.round(((counts.avail + counts.busy + counts.wrap) / counts.total) * 100) : 0;
  const longestHold = useMemo(() => (calls || []).reduce((m, c) => Math.max(m, c.holdTime ?? c.duration), 0), [calls]);

  const updatedStr = new Date(lastUpdated).toLocaleTimeString('vi-VN', { hour12: false });

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="text-xs text-muted-foreground font-mono">
        <span>Trang chủ</span>
        <span className="mx-1.5 opacity-50">/</span>
        <span className="text-foreground">Giám sát trực tiếp</span>
      </div>

      {/* Tab nav: Cuộc gọi trực tiếp / Trạng thái agent / Thống kê team */}
      <div className="flex items-center gap-0 border-b border-border">
        {MONITORING_TABS.map(({ label, to }, i) => {
          // Default-active first tab while on the live-dashboard root (/monitoring),
          // else highlight tab whose route matches current path.
          const onRoot = location.pathname === '/monitoring';
          const active = onRoot ? i === 0 : location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {/* Header strip — title + REALTIME pulse + last update + refresh */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold uppercase tracking-wider text-foreground/85">Giám sát trực tiếp</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/25 px-2 py-0.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
              REALTIME
            </span>
          </span>
          <span className="text-xs text-muted-foreground">
            Cập nhật lần cuối: <span className="font-mono">{updatedStr}</span>
          </span>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => { refetchAgents(); refetchCalls(); }}
          title="Làm mới"
        >
          <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
        </Button>
      </div>

      {/* Live refresh pulse line */}
      <motion.div
        key={lastUpdated}
        initial={{ scaleX: 0, opacity: 0.8 }}
        animate={{ scaleX: 1, opacity: 0 }}
        transition={{ duration: 1.2 }}
        className="h-px w-full origin-left bg-emerald-500"
      />

      {/* Filter row */}
      <div className="flex items-end gap-3 flex-wrap">
        <FilterBlock label="CLUSTER">
          <Select value={clusterFilter} onValueChange={(v) => setClusterFilter(v ?? 'all')}>
            <SelectTrigger className="h-9 w-44">
              <span>{CLUSTER_FILTER_LABELS[clusterFilter] ?? clusterFilter}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="prod-01">Production-01</SelectItem>
            </SelectContent>
          </Select>
        </FilterBlock>
        <FilterBlock label="TEAM">
          <Select value={teamFilter} onValueChange={(v) => setTeamFilter(v ?? 'all')}>
            <SelectTrigger className="h-9 w-44">
              <span className="truncate">
                {teamFilter === 'all'
                  ? 'Tất cả Team'
                  : teamOptions.find((t) => t.id === teamFilter)?.name ?? teamFilter}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả Team</SelectItem>
              {teamOptions.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBlock>
        <FilterBlock label="STATUS">
          <Select value={filter} onValueChange={(v) => setFilter((v ?? 'active') as StatusFilter)}>
            <SelectTrigger className="h-9 w-44">
              <span>{STATUS_FILTER_LABELS[filter]}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="active">Đang hoạt động</SelectItem>
              <SelectItem value="avail">AVAIL</SelectItem>
              <SelectItem value="busy">BUSY</SelectItem>
              <SelectItem value="wrap">WRAP</SelectItem>
              <SelectItem value="dnd">DND</SelectItem>
              <SelectItem value="offline">OFFLINE</SelectItem>
            </SelectContent>
          </Select>
        </FilterBlock>
        <Button variant="outline" size="icon" className="ml-auto" title="Bộ lọc nâng cao">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {/* 3-col grid — agent grid / active calls / performance sidebar */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_320px]">
        {/* Col 1: Agent grid */}
        <Panel title={`TRẠNG THÁI AGENT (${filtered.length}/${counts.total})`}
          headerExtra={<StatusLegend />}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
            {filtered.length === 0 ? (
              <p className="col-span-full py-6 text-center text-sm italic text-muted-foreground">
                Không có agent phù hợp.
              </p>
            ) : filtered.map((a) => (
              <AgentCard key={a.id} agent={a} />
            ))}
          </div>
        </Panel>

        {/* Col 2: Active calls list */}
        <Panel title={`CUỘC GỌI ĐANG DIỄN RA (${callsLen.toString().padStart(2, '0')})`}>
          {callsLen === 0 ? (
            <p className="py-6 text-center text-sm italic text-muted-foreground">
              Không có cuộc gọi nào
            </p>
          ) : (
            <ul className="space-y-3">
              {(calls || []).map((c) => {
                const inbound = c.direction === 'inbound';
                const hold = c.holdTime ?? c.duration;
                const max = c.maxHoldTime ?? 600;
                const pct = Math.min(100, Math.round((hold / max) * 100));
                const warn = pct > 60;
                return (
                  <li key={c.uuid} className="rounded-md border border-border p-3 dashed-divider hover:bg-muted/40 transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        {inbound
                          ? <ArrowDownLeft className="h-4 w-4 text-emerald-600 shrink-0" />
                          : <ArrowUpRight className="h-4 w-4 text-blue-600 shrink-0" />}
                        <div className="min-w-0">
                          <div className="font-mono font-semibold text-sm text-foreground truncate">
                            {maskPhone(c.callerNumber)}
                          </div>
                          {c.destinationLabel && (
                            <div className="text-[11px] text-muted-foreground truncate">→ {c.destinationLabel}</div>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-medium text-foreground">{c.agentName || c.agentExtension}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">Ext: {c.agentExtension}</div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        <span>Hold: {formatHold(hold)}</span>
                        <span className="opacity-50">·</span>
                        <span>MAX: {formatHold(max)}</span>
                        {warn && <span className="rounded-full bg-red-50 dark:bg-red-900/25 text-red-700 dark:text-red-400 px-1.5">WARNING</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        <CallActionIcon icon={Eye} title="Theo dõi" onClick={() => undefined} />
                        <CallActionIcon icon={Ear} title="Nghe thầm" onClick={() => whisperMutation.mutate(c.uuid)} />
                        <CallActionIcon icon={LogOut} title="Ngắt" onClick={() => undefined} />
                      </div>
                    </div>
                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn('h-full transition-all', warn ? 'bg-red-500' : 'bg-primary')}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {/* Col 3: Performance sidebar */}
        <div className="space-y-4">
          <Panel title="HIỆU SUẤT CUỘC GỌI">
            <div className="flex flex-col items-center gap-3">
              <DonutGauge value={answerRate} label="ANSWER RATE" />
              <div className="grid grid-cols-2 gap-2 w-full">
                <KPITile label="CALLS/MIN" value={(callsLen * 1.5).toFixed(1)} />
                <KPITile label="AVG WAIT" value={formatHold(longestHold)} />
              </div>
            </div>
          </Panel>

          {longestHold > 60 && (
            <div className="rounded-md border border-red-200 dark:border-red-900/50 bg-red-50/60 dark:bg-red-900/15 p-3">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                <AlertCircle className="h-4 w-4" />
                <span className="font-mono text-[10px] uppercase tracking-widest font-semibold">
                  CẢNH BÁO HÀNG CHỜ
                </span>
              </div>
              <p className="mt-2 text-xs text-foreground">
                Khách hàng đợi lâu nhất
              </p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="font-mono text-2xl font-bold text-red-600 dark:text-red-400">
                  {formatHold(longestHold)}
                </span>
                <Button size="sm" variant="destructive">XỬ LÝ NGAY</Button>
              </div>
            </div>
          )}

          <div className="rounded-md border border-border bg-card p-3 space-y-2">
            <StatRow label="Cuộc gọi nhỡ (Abandoned)" value="—" />
            <StatRow label="Tổng cuộc gọi (Today)" value="—" />
            <StatRow label="Agent đang rảnh" value={counts.avail.toString().padStart(2, '0')} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Small helpers / sub-components ─────────────────────────────

function FilterBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function Panel({ title, headerExtra, children }: { title: string; headerExtra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-border bg-card overflow-hidden flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-dashed border-border bg-muted/20">
        <h2 className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</h2>
        {headerExtra}
      </header>
      <div className="p-4 flex-1">{children}</div>
    </section>
  );
}

function StatusLegend() {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-sm bg-emerald-500" title="AVAIL" />
      <span className="h-2 w-2 rounded-sm bg-amber-500" title="BUSY" />
      <span className="h-2 w-2 rounded-sm bg-blue-500" title="WRAP" />
      <span className="h-2 w-2 rounded-sm bg-red-500" title="DND" />
    </div>
  );
}

function AgentCard({ agent }: { agent: { fullName: string; extension: string; status: Status; callDurationSec: number; queueName?: string } }) {
  const meta = STATUS_META[agent.status];
  const dur = agent.callDurationSec > 0 ? formatHold(agent.callDurationSec) : '';
  return (
    <div className="relative flex flex-col rounded-md border border-border bg-card overflow-hidden">
      <div className={cn('absolute inset-y-0 left-0 w-1', meta.rail)} />
      <div className="px-3 pt-2 pl-4 flex items-center gap-2">
        <Avatar className="h-7 w-7">
          <AvatarFallback className="text-[10px] font-bold bg-accent text-primary">{initials(agent.fullName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">{agent.fullName.split(' ').slice(-2).join(' ')}</p>
          <p className="font-mono text-[10px] text-muted-foreground">Ext: {agent.extension}</p>
        </div>
      </div>
      <div className="border-t border-dashed border-border my-1" />
      <div className="px-3 pb-2 pl-4 flex items-center justify-between gap-1">
        <span className={cn('inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-mono font-semibold tracking-widest', meta.chip)}>
          {meta.label}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">{dur}</span>
      </div>
      {agent.queueName && (
        <div className="px-3 pb-2 pl-4 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/80">
          QUEUE: {agent.queueName}
        </div>
      )}
    </div>
  );
}

function CallActionIcon({ icon: Icon, title, onClick }: { icon: React.ElementType; title: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function DonutGauge({ value, label }: { value: number; label: string }) {
  const radius = 56;
  const c = 2 * Math.PI * radius;
  const offset = c - (value / 100) * c;
  return (
    <div className="relative flex items-center justify-center">
      <svg width={140} height={140} className="-rotate-90">
        <circle cx={70} cy={70} r={radius} strokeWidth={8} className="fill-none stroke-muted" />
        <circle
          cx={70}
          cy={70}
          r={radius}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="fill-none stroke-primary transition-all"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-foreground tabular-nums">{value}<span className="text-base">%</span></span>
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mt-0.5">{label}</span>
      </div>
    </div>
  );
}

function KPITile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
      <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="font-mono text-base font-bold text-foreground tabular-nums mt-0.5">{value}</p>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-bold text-foreground tabular-nums">{value}</span>
    </div>
  );
}

// Show last 4 digits, mask the rest — quick anti-shoulder-surfing for the live monitor.
function maskPhone(phone: string): string {
  if (!phone) return '';
  if (phone.length <= 4) return phone;
  const visible = phone.slice(-4);
  const stars = '*'.repeat(Math.max(0, phone.length - 4));
  return stars + visible;
}
