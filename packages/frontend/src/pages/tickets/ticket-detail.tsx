import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VI } from '@/lib/vi-text';
import api from '@/services/api-client';
import { TICKET_STATUSES, type TicketStatus, type TicketPriority } from '@shared/constants/enums';

interface TicketDetail {
  id: string;
  content: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  firstResponseAt?: string | null;
  resolvedAt?: string | null;
  slaBreached?: boolean;
  contact: { id: string; fullName: string; phone: string } | null;
  createdBy: { fullName: string } | null;
  assignedTo: { fullName: string } | null;
}

interface Macro {
  id: string;
  name: string;
  content: string;
}

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

const STATUS_COLORS: Record<TicketStatus, string> = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-700',
};

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedMacro, setSelectedMacro] = useState('');

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => api.get<{ data: TicketDetail }>(`/tickets/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });

  const { data: macros } = useQuery({
    queryKey: ['macros'],
    queryFn: () => api.get<{ data: Macro[] }>('/macros').then((r) => r.data.data),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => api.patch(`/tickets/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      toast.success('Đã cập nhật trạng thái');
    },
    onError: () => toast.error('Cập nhật thất bại'),
  });

  const macroMutation = useMutation({
    mutationFn: (macroId: string) => api.post('/macros/apply', { macroId, ticketId: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', id] });
      setSelectedMacro('');
      toast.success('Đã áp dụng mẫu trả lời');
    },
    onError: () => toast.error('Áp dụng mẫu thất bại'),
  });

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!ticket) {
    return <p className="text-muted-foreground">{VI.actions.noData}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/tickets')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{VI.ticket.title} #{ticket.id.slice(0, 8)}</h1>
          <div className="flex gap-2 mt-1">
            <Badge className={PRIORITY_COLORS[ticket.priority]}>{VI.ticket.priorities[ticket.priority]}</Badge>
            <Badge className={STATUS_COLORS[ticket.status]}>{VI.ticket.statuses[ticket.status]}</Badge>
            {ticket.slaBreached && <Badge className="bg-red-500 text-white">SLA Vi phạm</Badge>}
          </div>
        </div>
        <Select value={ticket.status} onValueChange={(v) => v && statusMutation.mutate(v)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TICKET_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{VI.ticket.statuses[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{VI.ticket.content}</CardTitle></CardHeader>
          <CardContent>
            <div className="whitespace-pre-wrap rounded-md bg-muted p-4 text-sm">{ticket.content}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Thông tin</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div><p className="text-xs text-muted-foreground">{VI.ticket.category}</p><p className="font-medium">{ticket.category}</p></div>
            <div><p className="text-xs text-muted-foreground">{VI.contact.assignedTo}</p><p className="font-medium">{ticket.assignedTo?.fullName ?? '—'}</p></div>
            <div><p className="text-xs text-muted-foreground">Người tạo</p><p className="font-medium">{ticket.createdBy?.fullName ?? '—'}</p></div>
            <div><p className="text-xs text-muted-foreground">{VI.contact.createdAt}</p><p className="font-medium">{format(new Date(ticket.createdAt), 'dd/MM/yyyy HH:mm')}</p></div>
            {ticket.firstResponseAt && (
              <div><p className="text-xs text-muted-foreground">Phản hồi đầu</p><p className="font-medium">{format(new Date(ticket.firstResponseAt), 'dd/MM HH:mm')}</p></div>
            )}
            {ticket.resolvedAt && (
              <div><p className="text-xs text-muted-foreground">Giải quyết</p><p className="font-medium">{format(new Date(ticket.resolvedAt), 'dd/MM HH:mm')}</p></div>
            )}
            {ticket.contact && (
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">{VI.contact.fullName}</p>
                <p className="font-medium cursor-pointer text-primary hover:underline" onClick={() => navigate(`/contacts/${ticket.contact!.id}`)}>
                  {ticket.contact.fullName} — {ticket.contact.phone}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Macro apply section */}
      {macros && macros.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4" /> Mẫu trả lời nhanh
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Select value={selectedMacro} onValueChange={(v) => setSelectedMacro(v || '')}>
                <SelectTrigger className="w-64">
                  {selectedMacro
                    ? <span>{macros.find((m) => m.id === selectedMacro)?.name}</span>
                    : <span className="text-muted-foreground">Chọn mẫu...</span>}
                </SelectTrigger>
                <SelectContent>
                  {macros.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                disabled={!selectedMacro || macroMutation.isPending}
                onClick={() => selectedMacro && macroMutation.mutate(selectedMacro)}
              >
                Áp dụng
              </Button>
            </div>
            {selectedMacro && (
              <div className="mt-3 rounded-md bg-muted p-3 text-sm text-muted-foreground whitespace-pre-wrap">
                {macros.find((m) => m.id === selectedMacro)?.content}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
