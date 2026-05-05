import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import api from '@/services/api-client';
import { type TicketStatus, type TicketPriority } from '@shared/constants/enums';
import { VI } from '@/lib/vi-text';
import { TicketDetailCustomerPanel } from './ticket-detail-customer-panel';
import { TicketDetailActionsPanel } from './ticket-detail-actions-panel';

export interface TicketDetailDialogProps {
  ticketId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
}

interface TicketFull {
  id: string;
  subject: string;
  content?: string | null;
  resultCode?: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  slaBreached?: boolean;
  createdAt: string;
  contact: { id: string; fullName: string; phone: string; email?: string | null; address?: string | null } | null;
  user?: { fullName: string; extension?: string | null; team?: { name: string } | null } | null;
  category?: { id: string; name: string } | null;
  callLog?: {
    id: string;
    callUuid?: string | null;
    startTime: string;
    answerTime?: string | null;
    endTime?: string | null;
    duration: number;
    billsec?: number | null;
    hangupCause?: string | null;
    sipCode?: string | null;
    recordingPath?: string | null;
    direction: 'inbound' | 'outbound';
    callerNumber: string;
    destinationNumber: string;
  } | null;
  auditLog: Array<{
    id: string;
    action: string;
    createdAt: string;
    user?: { fullName: string } | null;
    changes?: Record<string, { from: unknown; to: unknown }> | null;
  }>;
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

export function TicketDetailDialog({ ticketId, onClose, onUpdated }: TicketDetailDialogProps): React.JSX.Element {
  const isOpen = ticketId !== null;

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => api.get<{ data: TicketFull }>(`/tickets/${ticketId}`).then((r) => r.data.data),
    enabled: !!ticketId,
  });

  const ticketRef = ticket ? `#TK-${ticket.id.slice(0, 8).toUpperCase()}` : '';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[1100px] max-h-[90vh] overflow-y-auto" showCloseButton>
        {/* ── Sticky dialog header ── */}
        <DialogHeader className="border-b border-dashed border-border pb-4">
          {isLoading || !ticket ? (
            <div className="space-y-2">
              <Skeleton className="h-6 w-64" />
              <Skeleton className="h-4 w-40" />
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2.5 pr-8">
              {/* Mono ticket ref */}
              <span className="font-mono text-base font-bold text-primary tracking-tight">
                {ticketRef}
              </span>
              <span className="text-muted-foreground">·</span>
              <DialogTitle className="text-base font-semibold truncate max-w-[380px]">
                {ticket.subject}
              </DialogTitle>
              {/* Status pill */}
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${STATUS_COLORS[ticket.status]}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {VI.ticket.statuses[ticket.status]}
              </span>
              {/* Priority dot */}
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOTS[ticket.priority]}`}
                title={VI.ticket.priorities[ticket.priority]}
              />
              <span className="text-xs text-muted-foreground font-mono">
                {VI.ticket.priorities[ticket.priority]}
              </span>
              {ticket.slaBreached && (
                <span className="text-[10px] bg-destructive/10 text-destructive px-2 py-0.5 rounded uppercase font-bold">
                  SLA Vi phạm
                </span>
              )}
              <span className="text-xs text-muted-foreground font-mono ml-auto">
                {format(new Date(ticket.createdAt), 'dd/MM/yyyy HH:mm')}
              </span>
            </div>
          )}
        </DialogHeader>

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-6 mt-4">
            <div className="space-y-3">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        )}

        {!isLoading && ticket && (
          <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-6 mt-4">
            <TicketDetailCustomerPanel
              contact={ticket.contact}
              callLog={ticket.callLog ?? null}
              agent={ticket.user ?? null}
              subject={ticket.subject}
              content={ticket.content}
              category={ticket.category ?? null}
              resultCode={ticket.resultCode}
            />
            <TicketDetailActionsPanel
              ticketId={ticket.id}
              status={ticket.status}
              priority={ticket.priority}
              category={ticket.category ?? null}
              contactPhone={ticket.contact?.phone ?? null}
              contactName={ticket.contact?.fullName ?? null}
              auditLog={ticket.auditLog}
              onUpdated={onUpdated}
              onClose={onClose}
            />
          </div>
        )}

        {!isLoading && !ticket && (
          <p className="text-sm text-muted-foreground py-4">Không tìm thấy phiếu ghi</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
