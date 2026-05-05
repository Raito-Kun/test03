import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Phone, Trash2, CheckCircle2, UserCheck, MoveRight, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClickToCallButton } from '@/components/click-to-call-button';
import { TicketAuditTimeline } from './ticket-audit-timeline';
import { TicketResolutionDialog } from './ticket-resolution-dialog';
import { VI } from '@/lib/vi-text';
import api from '@/services/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { TICKET_STATUSES, TICKET_PRIORITIES, type TicketStatus, type TicketPriority } from '@shared/constants/enums';

interface AuditEntry {
  id: string;
  action: string;
  createdAt: string;
  user?: { fullName: string } | null;
  changes?: Record<string, { from: unknown; to: unknown }> | null;
}

interface ActionsPanelProps {
  ticketId: string;
  status: TicketStatus;
  priority: TicketPriority;
  category?: { id: string; name: string } | null;
  contactPhone?: string | null;
  contactName?: string | null;
  auditLog: AuditEntry[];
  onUpdated?: () => void;
  onClose?: () => void;
}

export function TicketDetailActionsPanel({
  ticketId, status, priority, contactPhone, contactName, auditLog, onUpdated, onClose,
}: ActionsPanelProps) {
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const canDelete = role === 'super_admin' || role === 'admin';
  const [note, setNote] = useState('');
  const [pendingStatus, setPendingStatus] = useState<TicketStatus>(status);
  const [pendingPriority, setPendingPriority] = useState<TicketPriority>(priority);
  const [showResolution, setShowResolution] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.patch(`/tickets/${ticketId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
      toast.success('Đã cập nhật phiếu');
      onUpdated?.();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      toast.error(msg || 'Cập nhật thất bại');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/tickets/${ticketId}`),
    onSuccess: () => {
      toast.success('Đã xóa phiếu ghi');
      queryClient.invalidateQueries({ queryKey: ['tickets-kanban'] });
      onUpdated?.();
      onClose?.();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      toast.error(msg || 'Xóa phiếu thất bại');
    },
  });

  const noteMutation = useMutation({
    mutationFn: (content: string) => api.post(`/tickets/${ticketId}/notes`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
      toast.success('Đã thêm ghi chú');
      setNote('');
      onUpdated?.();
    },
    onError: () => toast.error('Thêm ghi chú thất bại'),
  });

  function handleStatusChange(val: string | null) {
    if (!val) return;
    if (val === 'resolved') {
      setShowResolution(true);
      return;
    }
    setPendingStatus(val as TicketStatus);
    updateMutation.mutate({ status: val });
  }

  function handlePriorityChange(val: string | null) {
    if (!val) return;
    setPendingPriority(val as TicketPriority);
    updateMutation.mutate({ priority: val });
  }

  async function handleResolveConfirm({ resultCode, note: resolveNote }: { resultCode: string; note: string }) {
    await updateMutation.mutateAsync({ status: 'resolved', resultCode, content: resolveNote });
    setPendingStatus('resolved');
    setShowResolution(false);
  }

  const isResolved = pendingStatus === 'resolved' || pendingStatus === 'closed';

  return (
    <div className="space-y-5">
      {/* ── Action buttons stack ── */}
      <div className="rounded-xl border border-dashed border-border overflow-hidden">
        {/* Resolve — filled violet */}
        <button
          type="button"
          disabled={isResolved || updateMutation.isPending}
          onClick={() => setShowResolution(true)}
          className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold transition-colors border-b border-dashed border-border ${
            isResolved
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`}
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Giải quyết phiếu
        </button>

        {/* Re-assign */}
        <button
          type="button"
          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-foreground hover:bg-accent/50 transition-colors border-b border-dashed border-border"
        >
          <UserCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
          Phân công lại
        </button>

        {/* Move to */}
        <button
          type="button"
          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-foreground hover:bg-accent/50 transition-colors border-b border-dashed border-border"
        >
          <MoveRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          Chuyển sang
        </button>

        {/* Add note */}
        <button
          type="button"
          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-foreground hover:bg-accent/50 transition-colors"
          onClick={() => document.getElementById(`note-area-${ticketId}`)?.focus()}
        >
          <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
          Thêm ghi chú
        </button>
      </div>

      {/* ── C2C ── */}
      {contactPhone && (
        <div>
          <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
            <Phone className="h-3.5 w-3.5" /> Gọi lại khách hàng
          </Label>
          <ClickToCallButton
            phone={contactPhone}
            contactName={contactName ?? undefined}
            size="default"
            variant="default"
          />
        </div>
      )}

      {/* ── Status ── */}
      <div className="space-y-1.5">
        <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          {VI.ticket.status}
        </Label>
        <Select value={pendingStatus} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-full">
            <SelectValue>{VI.ticket.statuses[pendingStatus]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {TICKET_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{VI.ticket.statuses[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Priority ── */}
      <div className="space-y-1.5">
        <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          {VI.ticket.priority}
        </Label>
        <Select value={pendingPriority} onValueChange={handlePriorityChange}>
          <SelectTrigger className="w-full">
            <SelectValue>{VI.ticket.priorities[pendingPriority]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {TICKET_PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>{VI.ticket.priorities[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Add note ── */}
      <div className="space-y-1.5">
        <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Ghi chú thêm
        </Label>
        <Textarea
          id={`note-area-${ticketId}`}
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Nhập ghi chú..."
          className="border-dashed"
        />
        <Button
          size="sm"
          variant="outline"
          className="w-full border-dashed"
          disabled={!note.trim() || noteMutation.isPending}
          onClick={() => note.trim() && noteMutation.mutate(note.trim())}
        >
          {noteMutation.isPending ? 'Đang lưu...' : '+ Thêm ghi chú'}
        </Button>
      </div>

      {/* ── Audit timeline ── */}
      <div className="space-y-1.5">
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Lịch sử thao tác
        </p>
        <TicketAuditTimeline entries={auditLog} />
      </div>

      {/* ── Delete (admin only) ── */}
      {canDelete && (
        <>
          <div className="border-t border-dashed border-border" />
          <Button
            variant="outline"
            size="sm"
            className="w-full text-destructive border-destructive/30 hover:bg-destructive/5 border-dashed"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (window.confirm('Xóa phiếu ghi này? Hành động không thể hoàn tác.')) {
                deleteMutation.mutate();
              }
            }}
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            {deleteMutation.isPending ? 'Đang xóa...' : 'Xóa phiếu ghi'}
          </Button>
        </>
      )}

      {/* Resolution dialog */}
      <TicketResolutionDialog
        open={showResolution}
        onCancel={() => setShowResolution(false)}
        onConfirm={handleResolveConfirm}
      />
    </div>
  );
}
