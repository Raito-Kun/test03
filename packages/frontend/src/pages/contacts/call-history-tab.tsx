import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
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
          <Skeleton key={i} className="h-8 w-full" />
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
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th className="text-left py-2 pr-3 font-medium">Thời gian</th>
            <th className="text-left py-2 pr-3 font-medium">Số</th>
            <th className="text-left py-2 pr-3 font-medium">Hướng</th>
            <th className="text-left py-2 pr-3 font-medium">Thời lượng</th>
            <th className="text-left py-2 pr-3 font-medium">Agent</th>
            <th className="text-left py-2 font-medium">Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30">
              <td className="py-2 pr-3 whitespace-nowrap">
                {format(new Date(log.startTime), 'dd/MM/yy HH:mm')}
              </td>
              <td className="py-2 pr-3 whitespace-nowrap">
                {fmtPhone(log.direction === 'inbound' ? log.callerNumber : log.destinationNumber)}
              </td>
              <td className="py-2 pr-3">
                <Badge variant={log.direction === 'inbound' ? 'secondary' : 'outline'} className="text-xs">
                  {log.direction === 'inbound' ? 'Đến' : 'Ra'}
                </Badge>
              </td>
              <td className="py-2 pr-3">{formatDuration(log.billsec ?? log.duration)}</td>
              <td className="py-2 pr-3">{log.user?.fullName ?? '—'}</td>
              <td className="py-2">
                {log.dispositionCode?.label
                  ? <Badge variant="outline" className="text-xs">{log.dispositionCode.label}</Badge>
                  : <span className="text-muted-foreground">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
