import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { MoreHorizontal, Inbox } from 'lucide-react';
import { VI } from '@/lib/vi-text';
import api from '@/services/api-client';
import { TicketCard } from './ticket-card';
import {
  useTicketKanban,
  TICKET_STATUSES,
  type KanbanTicket,
  type TicketStatus,
} from './use-ticket-kanban';
import { TicketDetailDialog } from './ticket-detail-dialog';
import { TicketResolutionDialog } from './ticket-resolution-dialog';

const COLUMN_LABELS: Record<TicketStatus, string> = {
  open: 'MỚI',
  in_progress: 'ĐANG XỬ LÝ',
  resolved: 'CHỜ PHẢN HỒI',
  closed: 'ĐÃ ĐÓNG',
};

function KanbanColumn({
  status,
  tickets,
  collapsed,
  onToggleCollapse,
  onCardClick,
}: {
  status: TicketStatus;
  tickets: KanbanTicket[];
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onCardClick: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  // Active column chip style: "Đang xử lý" gets primary bg
  const countChipCls = status === 'in_progress'
    ? 'bg-primary text-primary-foreground'
    : 'bg-muted text-muted-foreground';

  return (
    <div className="flex flex-col min-w-[260px] w-full">
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-foreground uppercase tracking-wider">
            {COLUMN_LABELS[status]}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${countChipCls}`}>
            {tickets.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Tùy chọn cột"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      {!collapsed && (
        <div
          ref={setNodeRef}
          className={`flex-1 rounded-xl p-2 min-h-[200px] transition-colors ${
            isOver ? 'bg-primary/5 ring-2 ring-primary/30' : 'bg-muted/30'
          }`}
        >
          <SortableContext items={tickets.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            {tickets.map((t) => (
              <TicketCard key={t.id} ticket={t} onClick={onCardClick} />
            ))}
          </SortableContext>
          {tickets.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
              <Inbox className="h-5 w-5 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground italic">Kéo phiếu vào đây để chuyển trạng thái</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface TicketKanbanProps {
  priorityFilter: string;
  searchQuery: string;
}

export function TicketKanban({ priorityFilter, searchQuery }: TicketKanbanProps) {
  const queryClient = useQueryClient();
  const { grouped, collapseClosed, setCollapseClosed, moveTicket } = useTicketKanban(
    priorityFilter,
    searchQuery,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingResolve, setPendingResolve] = useState<{ ticketId: string } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const ticketId = String(active.id);
    const newStatus = String(over.id) as TicketStatus;
    if (!TICKET_STATUSES.includes(newStatus)) return;

    if (newStatus === 'resolved') {
      // Optimistic move so card appears in column, then confirm
      moveTicket(ticketId, 'resolved');
      setPendingResolve({ ticketId });
    } else {
      moveTicket(ticketId, newStatus);
    }
  }

  async function handleResolutionConfirm(input: { resultCode: string; note: string }) {
    if (!pendingResolve) return;
    try {
      await api.patch(`/tickets/${pendingResolve.ticketId}`, {
        status: 'resolved',
        resultCode: input.resultCode,
        content: input.note,
      });
      queryClient.invalidateQueries({ queryKey: ['tickets-kanban'] });
    } catch {
      // Rollback optimistic move
      queryClient.invalidateQueries({ queryKey: ['tickets-kanban'] });
    }
    setPendingResolve(null);
  }

  function handleResolutionCancel() {
    if (pendingResolve) {
      // Rollback
      queryClient.invalidateQueries({ queryKey: ['tickets-kanban'] });
    }
    setPendingResolve(null);
  }

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-5 min-w-max items-start">
            {TICKET_STATUSES.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                tickets={grouped[status]}
                collapsed={status === 'closed' ? collapseClosed : undefined}
                onToggleCollapse={
                  status === 'closed' ? () => setCollapseClosed((v) => !v) : undefined
                }
                onCardClick={setSelectedId}
              />
            ))}
          </div>
        </div>
      </DndContext>

      <TicketDetailDialog
        ticketId={selectedId}
        onClose={() => setSelectedId(null)}
        onUpdated={() => queryClient.invalidateQueries({ queryKey: ['tickets-kanban'] })}
      />

      <TicketResolutionDialog
        open={!!pendingResolve}
        onCancel={handleResolutionCancel}
        onConfirm={handleResolutionConfirm}
      />
    </>
  );
}
