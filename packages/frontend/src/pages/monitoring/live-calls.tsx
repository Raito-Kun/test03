/* live-calls v2 — M3 lavender alignment */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, ArrowDownLeft, ArrowUpRight, MoreHorizontal } from 'lucide-react';
import { SectionHeader } from '@/components/ops/section-header';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import api from '@/services/api-client';
import { formatSec } from '@/components/monitoring/status-meta';

interface ActiveCallRow {
  uuid: string;
  agentName: string;
  agentExtension: string;
  callerNumber: string;
  destNumber: string;
  direction: string;
  duration: number;
  status: string;
}

const STATUS_PILL: Record<string, string> = {
  active:  'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-400 dark:border-emerald-800',
  ringing: 'bg-amber-50  text-amber-700  border-amber-200  dark:bg-amber-900/25  dark:text-amber-400  dark:border-amber-800',
  hold:    'bg-blue-50   text-blue-700   border-blue-200   dark:bg-blue-900/25   dark:text-blue-400   dark:border-blue-800',
  wrap_up: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/25 dark:text-violet-400 dark:border-violet-800',
};

const STATUS_VI: Record<string, string> = {
  active: 'Đang gọi', ringing: 'Đổ chuông', hold: 'Giữ máy', wrap_up: 'Kết thúc',
};

function StatusPill({ status }: { status: string }) {
  const cls = STATUS_PILL[status] ?? 'bg-muted text-muted-foreground border-border';
  const label = STATUS_VI[status] ?? status;
  return (
    <span className={cn('inline-block font-mono text-[10px] px-2 py-0.5 rounded border', cls)}>
      {label}
    </span>
  );
}

function AgentInitials({ name, extension }: { name: string; extension: string }) {
  const ini = (name || extension || '?').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div className="flex items-center gap-2">
      <div className="w-6 h-6 rounded-full bg-accent text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
        {ini}
      </div>
      <div>
        <div className="text-sm">{name || '—'}</div>
        <div className="font-mono text-[10px] text-muted-foreground">Ext: {extension}</div>
      </div>
    </div>
  );
}

export default function LiveCallsPage() {
  const queryClient = useQueryClient();
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data: rows, isFetching } = useQuery<ActiveCallRow[]>({
    queryKey: ['monitoring-live-calls'],
    queryFn: async () => {
      const { data: resp } = await api.get('/monitoring/active-calls');
      return (resp.data ?? []) as ActiveCallRow[];
    },
    refetchInterval: autoRefresh ? 5000 : false,
    retry: false,
  });

  const list = (rows ?? []).filter((r) => ['active', 'ringing', 'answered'].includes(r.status) || !['ended', 'failed'].includes(r.status));

  const liveBadge = (
    <div className="flex items-center gap-3">
      {/* Live pulsing badge */}
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/25 px-2.5 py-1">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
          Live · {list.length}
        </span>
      </span>
      {/* Auto-refresh toggle */}
      <Button
        variant={autoRefresh ? 'default' : 'outline'}
        size="sm"
        className={cn('h-8 text-xs', autoRefresh && 'bg-primary text-white hover:bg-primary/90')}
        onClick={() => setAutoRefresh((v) => !v)}
      >
        <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', isFetching && autoRefresh && 'animate-spin')} />
        {autoRefresh ? 'Tự động' : 'Thủ công'}
      </Button>
      {!autoRefresh && (
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => queryClient.invalidateQueries({ queryKey: ['monitoring-live-calls'] })}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="text-xs text-muted-foreground font-mono">
        <span>Trang chủ</span>
        <span className="mx-1.5 opacity-50">/</span>
        <span className="text-foreground">Cuộc gọi trực tiếp</span>
      </div>

      <SectionHeader label="Cuộc gọi trực tiếp" actions={liveBadge} />

      {/* Table */}
      <div className="rounded-md border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dashed border-border bg-muted/30">
              {['THỜI LƯỢNG', 'HƯỚNG', 'CALLER', 'DESTINATION', 'AGENT', 'TRẠNG THÁI', 'THAO TÁC'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground italic">
                  Không có cuộc gọi nào đang diễn ra
                </td>
              </tr>
            ) : list.map((c) => {
              const inbound = c.direction === 'inbound';
              const caller = inbound ? c.callerNumber : c.destNumber;
              const dest = inbound ? c.destNumber : c.callerNumber;
              return (
                <tr key={c.uuid} className="border-t border-dashed border-border hover:bg-muted/30 transition-colors">
                  {/* THỜI LƯỢNG */}
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs tabular-nums text-foreground">{formatSec(c.duration)}</span>
                  </td>
                  {/* HƯỚNG */}
                  <td className="px-4 py-3">
                    {inbound
                      ? <ArrowDownLeft className="h-4 w-4 text-primary" />
                      : <ArrowUpRight className="h-4 w-4 text-primary" />}
                  </td>
                  {/* CALLER */}
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-muted-foreground">{caller || '—'}</span>
                  </td>
                  {/* DESTINATION */}
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs">{dest || '—'}</span>
                  </td>
                  {/* AGENT */}
                  <td className="px-4 py-3">
                    <AgentInitials name={c.agentName} extension={c.agentExtension} />
                  </td>
                  {/* TRẠNG THÁI */}
                  <td className="px-4 py-3">
                    <StatusPill status={c.status} />
                  </td>
                  {/* THAO TÁC */}
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
