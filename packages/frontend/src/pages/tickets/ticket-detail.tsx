import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft, Zap, CheckCircle2, UserCheck, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VI } from '@/lib/vi-text';
import api from '@/services/api-client';
import { TICKET_STATUSES, type TicketStatus, type TicketPriority } from '@shared/constants/enums';
import { DottedCard } from '@/components/ops/dotted-card';
import { TicketDetailActionsPanel } from './ticket-detail-actions-panel';
import { TicketDetailCustomerPanel } from './ticket-detail-customer-panel';
import { TicketAuditTimeline } from './ticket-audit-timeline';

interface TicketDetail {
  id: string;
  subject?: string;
  content: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  firstResponseAt?: string | null;
  resolvedAt?: string | null;
  slaBreached?: boolean;
  contact: { id: string; fullName: string; phone: string; email?: string | null; address?: string | null } | null;
  createdBy: { fullName: string } | null;
  assignedTo: { fullName: string } | null;
  categoryObj?: { id: string; name: string } | null;
  auditLog?: Array<{
    id: string;
    action: string;
    createdAt: string;
    user?: { fullName: string } | null;
    changes?: Record<string, { from: unknown; to: unknown }> | null;
  }>;
}

interface Macro {
  id: string;
  name: string;
  content: string;
}

// Priority dot colors matching ticket-card.tsx
const PRIORITY_DOTS: Record<TicketPriority, string> = {
  low: 'bg-muted-foreground/40',
  medium: 'bg-primary',
  high: 'bg-amber-500',
  urgent: 'bg-destructive',
};

const STATUS_COLORS: Record<TicketStatus, string> = {
  open: 'bg-teal-100 text-teal-700',
  in_progress: 'bg-amber-100 text-amber-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-muted text-muted-foreground',
};

/** Derive two-letter initials from full name */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type DetailTab = 'detail' | 'comments' | 'history';

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedMacro, setSelectedMacro] = useState('');
  const [activeTab, setActiveTab] = useState<DetailTab>('detail');

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
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-8 space-y-4">
            <Skeleton className="h-48 w-full" />
          </div>
          <div className="col-span-4 space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return <p className="text-muted-foreground">{VI.actions.noData}</p>;
  }

  const ticketRef = `#TK-${ticket.id.slice(0, 8).toUpperCase()}`;
  const title = ticket.subject || ticket.content?.slice(0, 60) || 'Phiếu ghi';
  const assigneeName = ticket.assignedTo?.fullName ?? null;

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
        <button
          type="button"
          onClick={() => navigate('/tickets')}
          className="hover:text-primary transition-colors"
        >
          Phiếu ghi
        </button>
        <span>/</span>
        <span className="text-foreground font-semibold">{ticketRef}</span>
      </div>

      {/* ── Header card ── */}
      <div className="bg-card rounded-xl shadow-sm p-6 border border-dashed border-border">
        <div className="flex items-start justify-between gap-4">
          {/* Left: ticket ref + status + priority */}
          <div className="flex items-start gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 mt-0.5"
              onClick={() => navigate('/tickets')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              {/* Mono ticket ref */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-mono text-2xl font-bold text-primary tracking-tight">
                  {ticketRef}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${STATUS_COLORS[ticket.status]}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {VI.ticket.statuses[ticket.status]}
                </span>
                {/* Priority dot */}
                <span
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${PRIORITY_DOTS[ticket.priority]}`}
                  title={VI.ticket.priorities[ticket.priority]}
                />
                <span className="text-xs text-muted-foreground font-mono">
                  {VI.ticket.priorities[ticket.priority]}
                </span>
                {ticket.slaBreached && (
                  <Badge className="bg-destructive/10 text-destructive text-[10px] uppercase font-bold">
                    SLA Vi phạm
                  </Badge>
                )}
              </div>
              {/* Title */}
              <h2 className="text-lg font-semibold text-foreground mt-1.5 max-w-2xl">
                {title}
              </h2>
              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-3 mt-2">
                {assigneeName && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-accent border border-dashed border-border flex items-center justify-center text-[9px] font-bold text-primary">
                      {initials(assigneeName)}
                    </div>
                    <span className="text-xs font-medium text-foreground">{assigneeName}</span>
                  </div>
                )}
                {ticket.resolvedAt && (
                  <span className="text-xs text-muted-foreground font-mono">
                    Giải quyết: {format(new Date(ticket.resolvedAt), 'dd/MM/yyyy HH:mm')}
                  </span>
                )}
                <span className="text-xs text-muted-foreground font-mono">
                  Tạo: {format(new Date(ticket.createdAt), 'dd/MM/yyyy HH:mm')}
                </span>
                {ticket.category && (
                  <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-accent/50 text-primary border border-dashed border-border">
                    {ticket.category}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: action stack */}
          <div className="flex flex-col gap-2 shrink-0 min-w-[140px]">
            <Button
              className="bg-primary text-primary-foreground shadow-lg shadow-primary/20 gap-2 w-full"
              onClick={() => statusMutation.mutate('resolved')}
              disabled={ticket.status === 'resolved' || ticket.status === 'closed' || statusMutation.isPending}
            >
              <CheckCircle2 className="h-4 w-4" />
              Giải quyết
            </Button>
            <Button variant="outline" className="border-dashed gap-2 w-full">
              <UserCheck className="h-4 w-4" />
              Phân công lại
            </Button>
            <Button variant="ghost" size="sm" className="gap-1.5 w-full">
              <MoreHorizontal className="h-4 w-4" />
              Khác
            </Button>
          </div>
        </div>
      </div>

      {/* ── 8/4 grid ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left column (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {/* Tabbed card */}
          <div className="bg-card rounded-xl shadow-sm border border-dashed border-border overflow-hidden">
            {/* Tab strip */}
            <div className="flex border-b border-dashed border-border px-6">
              {(
                [
                  { key: 'detail', label: 'Chi tiết' },
                  { key: 'comments', label: 'Bình luận' },
                  { key: 'history', label: 'Lịch sử' },
                ] as { key: DetailTab; label: string }[]
              ).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  className={`px-4 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === t.key
                      ? 'font-bold text-primary border-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab body */}
            <div className="p-6">
              {activeTab === 'detail' && (
                <div className="space-y-6">
                  {/* Content */}
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                      {VI.ticket.content}
                    </p>
                    <div className="whitespace-pre-wrap rounded-lg bg-muted/40 p-4 text-sm border border-dashed border-border">
                      {ticket.content || '—'}
                    </div>
                  </div>

                  {/* 2-col meta grid */}
                  <div className="grid grid-cols-2 gap-y-5 gap-x-8 border-t border-dashed border-border pt-5">
                    <div className="space-y-1">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                        {VI.ticket.category}
                      </p>
                      <p className="text-sm font-medium">{ticket.category || '—'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                        {VI.contact.assignedTo}
                      </p>
                      <p className="text-sm font-medium">{ticket.assignedTo?.fullName ?? '—'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                        Người tạo
                      </p>
                      <p className="text-sm font-medium">{ticket.createdBy?.fullName ?? '—'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                        {VI.contact.createdAt}
                      </p>
                      <p className="text-sm font-medium font-mono">
                        {format(new Date(ticket.createdAt), 'dd/MM/yyyy HH:mm')}
                      </p>
                    </div>
                    {ticket.firstResponseAt && (
                      <div className="space-y-1">
                        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                          Phản hồi đầu
                        </p>
                        <p className="text-sm font-medium font-mono">
                          {format(new Date(ticket.firstResponseAt), 'dd/MM HH:mm')}
                        </p>
                      </div>
                    )}
                    {ticket.resolvedAt && (
                      <div className="space-y-1">
                        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                          Giải quyết
                        </p>
                        <p className="text-sm font-medium font-mono">
                          {format(new Date(ticket.resolvedAt), 'dd/MM HH:mm')}
                        </p>
                      </div>
                    )}
                    {ticket.contact && (
                      <div className="col-span-2 space-y-1">
                        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                          {VI.contact.fullName}
                        </p>
                        <p
                          className="text-sm font-medium cursor-pointer text-primary hover:underline"
                          onClick={() => navigate(`/contacts/${ticket.contact!.id}`)}
                        >
                          {ticket.contact.fullName} — {ticket.contact.phone}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Status change select */}
                  <div className="border-t border-dashed border-border pt-4">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">
                      Đổi trạng thái
                    </p>
                    <Select value={ticket.status} onValueChange={(v) => v && statusMutation.mutate(v)}>
                      <SelectTrigger className="w-52">
                        <SelectValue>{VI.ticket.statuses[ticket.status]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {TICKET_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>{VI.ticket.statuses[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {activeTab === 'comments' && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Chưa có bình luận
                </p>
              )}

              {activeTab === 'history' && (
                <div>
                  {ticket.auditLog && ticket.auditLog.length > 0 ? (
                    <TicketAuditTimeline entries={ticket.auditLog} />
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      Chưa có lịch sử thao tác
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Macro apply section */}
          {macros && macros.length > 0 && (
            <DottedCard header={<span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground"><Zap className="h-3.5 w-3.5" /> Mẫu trả lời nhanh</span>}>
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
                <div className="mt-3 rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground whitespace-pre-wrap border border-dashed border-border">
                  {macros.find((m) => m.id === selectedMacro)?.content}
                </div>
              )}
            </DottedCard>
          )}
        </div>

        {/* Right rail (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Customer panel */}
          <div className="bg-card rounded-xl shadow-sm border border-dashed border-border p-5">
            <TicketDetailCustomerPanel
              contact={ticket.contact}
              callLog={null}
              agent={ticket.assignedTo ? { fullName: ticket.assignedTo.fullName } : null}
              subject={title}
              content={ticket.content}
              category={ticket.categoryObj ?? (ticket.category ? { name: ticket.category } : null)}
            />
          </div>

          {/* Audit timeline rail */}
          {ticket.auditLog && ticket.auditLog.length > 0 && (
            <div className="bg-card rounded-xl shadow-sm border border-dashed border-border p-5">
              <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-4">
                Lịch sử thao tác
              </p>
              <TicketAuditTimeline entries={ticket.auditLog} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
