import { useQuery } from '@tanstack/react-query';
import { PhoneCall } from 'lucide-react';
import { SectionHeader } from '@/components/ops/section-header';
import { DottedCard } from '@/components/ops/dotted-card';
import { Badge } from '@/components/ui/badge';
import api from '@/services/api-client';

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

function formatSec(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// No placeholder data — multi-tenant safety. Empty list when API unavailable.
export default function LiveCallsPage() {
  const { data: rows } = useQuery<ActiveCallRow[]>({
    queryKey: ['monitoring-live-calls'],
    queryFn: async () => {
      const { data: resp } = await api.get('/monitoring/active-calls');
      return (resp.data ?? []) as ActiveCallRow[];
    },
    refetchInterval: 10000,
    retry: false,
  });

  const list = rows ?? [];

  const liveHint = (
    <span className="font-mono text-[11px]" style={{ color: 'var(--color-status-err)' }}>
      {list.length} đang gọi
    </span>
  );

  return (
    <div className="space-y-6">
      <SectionHeader label="Cuộc gọi trực tiếp" hint={liveHint} />
      <DottedCard>
        {list.length === 0 ? (
          <p className="text-muted-foreground text-sm">Không có cuộc gọi đang diễn ra</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                {['Agent', 'Khách hàng', 'Số điện thoại', 'Hướng', 'Thời lượng', 'Trạng thái'].map((h) => (
                  <th key={h} className="text-left p-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((c) => {
                const customerPhone = c.direction === 'inbound' ? c.callerNumber : c.destNumber;
                return (
                  <tr key={c.uuid} className="border-t border-dashed hover:bg-muted/30">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <PhoneCall className="h-4 w-4 animate-pulse shrink-0" style={{ color: 'var(--color-status-err)' }} />
                        <span>{c.agentName || c.agentExtension}</span>
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">{c.agentName || '—'}</td>
                    <td className="p-3 font-mono text-xs">{customerPhone}</td>
                    <td className="p-3">
                      <Badge variant={c.direction === 'inbound' ? 'default' : 'secondary'}>
                        {c.direction === 'inbound' ? 'Vào' : 'Ra'}
                      </Badge>
                    </td>
                    <td className="p-3 font-mono">{formatSec(c.duration)}</td>
                    <td className="p-3">
                      <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: 'var(--color-status-ok)' }}>
                        {c.status === 'active' ? 'Đang gọi' : c.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </DottedCard>
    </div>
  );
}
