import { useCallStore } from '@/stores/call-store';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, PhoneOff, Clock, Ticket } from 'lucide-react';
import { fmtPhone, formatDuration } from '@/lib/format';
import { format } from 'date-fns';
import api from '@/services/api-client';
import { VI } from '@/lib/vi-text';

interface RecentCall {
  id: string;
  direction: string;
  duration: number;
  startTime: string;
  hangupCause?: string;
}

export function InboundCallPopup() {
  const popup = useCallStore((s) => s.inboundPopup);
  const dismiss = useCallStore((s) => s.dismissInboundPopup);

  const { data: recentCalls } = useQuery({
    queryKey: ['inbound-popup-calls', popup?.phone],
    queryFn: async () => {
      const { data } = await api.get('/call-logs', { params: { search: popup!.phone, limit: 5 } });
      return (data.data as RecentCall[]) ?? [];
    },
    enabled: !!popup?.phone,
  });

  const { data: contactInfo } = useQuery({
    queryKey: ['inbound-popup-contact', popup?.phone],
    queryFn: async () => {
      const { data } = await api.get('/contacts', { params: { search: popup!.phone, limit: 1 } });
      const contacts = data.data as { id: string; fullName: string; tags?: string[] }[];
      return contacts[0] ?? null;
    },
    enabled: !!popup?.phone,
  });

  const { data: ticketCount } = useQuery({
    queryKey: ['inbound-popup-tickets', contactInfo?.id],
    queryFn: async () => {
      const { data } = await api.get('/tickets', { params: { contactId: contactInfo!.id, status: 'open', limit: 1 } });
      return (data.data as { total?: number })?.total ?? 0;
    },
    enabled: !!contactInfo?.id,
  });

  if (!popup) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
      <Card className="w-96 animate-in zoom-in-95 shadow-xl">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Phone className="h-5 w-5 animate-pulse text-green-600" />
            Cuộc gọi đến
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Caller info */}
          <div className="text-center">
            <p className="text-xl font-semibold">{popup.contactName || fmtPhone(popup.phone)}</p>
            <p className="text-muted-foreground">{fmtPhone(popup.phone)}</p>
            {contactInfo?.tags && contactInfo.tags.length > 0 && (
              <div className="flex justify-center gap-1 mt-1">
                {contactInfo.tags.map((t) => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
              </div>
            )}
          </div>

          {/* Quick stats */}
          <div className="flex gap-3 justify-center">
            {ticketCount !== undefined && ticketCount > 0 && (
              <div className="flex items-center gap-1 text-sm text-orange-600">
                <Ticket className="h-4 w-4" />
                <span>{ticketCount} phiếu mở</span>
              </div>
            )}
            {recentCalls && recentCalls.length > 0 && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{recentCalls.length} cuộc gần đây</span>
              </div>
            )}
          </div>

          {/* Recent calls */}
          {recentCalls && recentCalls.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Lịch sử cuộc gọi gần đây</p>
              {recentCalls.slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1">
                  <Badge variant={c.direction === 'inbound' ? 'default' : 'secondary'} className="text-[10px]">
                    {c.direction === 'inbound' ? VI.callLog.inbound : VI.callLog.outbound}
                  </Badge>
                  <span>{formatDuration(c.duration)}</span>
                  <span className="text-muted-foreground">{format(new Date(c.startTime), 'dd/MM/yy HH:mm')}</span>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-center gap-3">
            <Button variant="destructive" size="sm" onClick={dismiss}>
              <PhoneOff className="mr-1 h-4 w-4" /> Từ chối
            </Button>
            <Button variant="default" size="sm" className="bg-green-600 hover:bg-green-700" onClick={dismiss}>
              <Phone className="mr-1 h-4 w-4" /> Nghe
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
