import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { PhoneCall, PhoneMissed } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/services/api-client';
import { formatDuration, fmtPhone } from '@/lib/format';

interface CallLog {
  id: string;
  callerNumber: string;
  destinationNumber?: string;
  direction: 'inbound' | 'outbound';
  duration: number;
  billsec?: number;
  startTime: string;
  hangupCause?: string;
  user?: { fullName: string };
  dispositionCode?: { label: string };
}

interface Props {
  contactId: string;
  phone: string;
}

function isAnswered(log: CallLog): boolean {
  return log.hangupCause === 'NORMAL_CLEARING' || (log.billsec !== undefined ? log.billsec > 0 : log.duration > 0);
}

export function CallHistoryTab({ phone }: Props) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['call-logs-contact', phone],
    queryFn: () =>
      api
        .get<{ data: CallLog[] }>('/call-logs', { params: { phone, limit: 20 } })
        .then((r) => r.data.data),
    enabled: !!phone,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Chưa có cuộc gọi nào
      </p>
    );
  }

  return (
    <div className="relative pl-6">
      {/* Vertical dashed connector */}
      <div className="absolute left-2.5 top-2 bottom-2 w-px border-l border-dashed border-border" />
      <div className="space-y-3">
        {logs.map((log) => {
          const answered = isAnswered(log);
          const duration = formatDuration(log.billsec ?? log.duration);
          const number = fmtPhone(log.direction === 'inbound' ? log.callerNumber : log.destinationNumber);
          return (
            <div key={log.id} className="relative flex items-start gap-3">
              {/* Node dot */}
              <div className={`absolute -left-6 top-2 w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-background shrink-0 ${
                answered ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
              }`}>
                {answered
                  ? <PhoneCall className="h-2.5 w-2.5" />
                  : <PhoneMissed className="h-2.5 w-2.5" />}
              </div>
              <div className="flex-1 flex items-center justify-between p-2.5 rounded-lg border border-dashed border-border hover:bg-muted/30 transition-colors">
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    {log.direction === 'inbound' ? 'Cuộc gọi đến' : 'Cuộc gọi đi'}
                    {number && <span className="ml-1.5 font-mono text-muted-foreground">· {number}</span>}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                    {duration} · {log.user?.fullName ?? '—'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    answered
                      ? 'bg-[var(--color-status-ok)]/10 text-[var(--color-status-ok)]'
                      : 'bg-[var(--color-status-err)]/10 text-[var(--color-status-err)]'
                  }`}>
                    {answered ? '✓ Đã trả lời' : '✗ Cuộc gọi nhỡ'}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap">
                    {format(new Date(log.startTime), 'dd/MM/yy HH:mm')}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
