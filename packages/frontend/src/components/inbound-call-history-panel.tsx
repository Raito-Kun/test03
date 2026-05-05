import { useQuery } from '@tanstack/react-query';
import { PhoneIncoming, PhoneOutgoing, Ticket, Phone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { formatDuration } from '@/lib/format';
import api from '@/services/api-client';

interface CallLogEntry {
  id: string;
  direction: 'inbound' | 'outbound';
  startTime: string;
  duration: number;
  dispositionCode?: string;
  agentName?: string;
  hangupCause?: string;
}

interface TicketCountResponse {
  total?: number;
  meta?: { total?: number };
}

export interface InboundCallHistoryPanelProps {
  contactId: string;
  contactName: string;
  contactPhone: string;
}

export function InboundCallHistoryPanel({
  contactId,
  contactName,
  contactPhone,
}: InboundCallHistoryPanelProps) {
  const { data: calls = [], isLoading: loadingCalls } = useQuery<CallLogEntry[]>({
    queryKey: ['contact-call-history', contactId],
    queryFn: async () => {
      const { data } = await api.get('/call-logs', {
        params: { contactId, limit: 10 },
      });
      return (data.data ?? []) as CallLogEntry[];
    },
    enabled: !!contactId,
  });

  const { data: ticketCount = 0 } = useQuery<number>({
    queryKey: ['contact-ticket-count', contactId],
    queryFn: async () => {
      const { data } = await api.get<TicketCountResponse>('/tickets', {
        params: { contactId, countOnly: true, limit: 1 },
      });
      return data.total ?? data.meta?.total ?? 0;
    },
    enabled: !!contactId,
  });

  return (
    <Card className="shadow-sm border bg-white w-full">
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <Phone className="h-4 w-4 text-muted-foreground" />
            Lịch sử cuộc gọi
          </span>
          {ticketCount > 0 && (
            <span className="flex items-center gap-1 text-xs font-normal text-orange-600">
              <Ticket className="h-3.5 w-3.5" />
              <span className="font-medium">{ticketCount}</span>
              <span>Tổng phiếu ghi</span>
            </span>
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {contactName} &bull; {contactPhone}
        </p>
      </CardHeader>

      <CardContent className="px-3 pb-3">
        {loadingCalls ? (
          <div className="space-y-1.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full rounded" />
            ))}
          </div>
        ) : calls.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">Không có cuộc gọi nào</p>
        ) : (
          <div className="space-y-1 max-h-52 overflow-y-auto">
            {calls.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-2 rounded bg-muted px-2 py-1.5 text-xs"
              >
                {c.direction === 'inbound' ? (
                  <PhoneIncoming className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <PhoneOutgoing className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                )}

                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 shrink-0 ${
                    c.direction === 'inbound'
                      ? 'border-emerald-200 text-emerald-700 bg-emerald-50'
                      : 'border-blue-200 text-blue-700 bg-blue-50'
                  }`}
                >
                  {c.direction === 'inbound' ? 'Cuộc gọi đến' : 'Cuộc gọi đi'}
                </Badge>

                <span className="text-muted-foreground shrink-0">
                  {format(new Date(c.startTime), 'dd/MM HH:mm')}
                </span>

                <span className="font-medium text-foreground shrink-0">
                  {formatDuration(c.duration)}
                </span>

                {c.dispositionCode && (
                  <span className="text-muted-foreground truncate">{c.dispositionCode}</span>
                )}

                {c.agentName && (
                  <span className="ml-auto text-muted-foreground truncate shrink-0 max-w-[80px]">
                    {c.agentName}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
