import { format } from 'date-fns';
import { CalendarClock } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { KanbanTicket, TicketPriority } from './use-ticket-kanban';

// Priority dot color per level
const PRIORITY_DOTS: Record<TicketPriority, string> = {
  low: 'bg-muted-foreground/40',
  medium: 'bg-primary',
  high: 'bg-amber-500',
  urgent: 'bg-destructive',
};

// Derive two-letter initials for assignee avatar
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Deterministic avatar bg color
const AVATAR_COLORS = [
  'bg-violet-100 text-violet-700',
  'bg-pink-100 text-pink-700',
  'bg-amber-100 text-amber-700',
  'bg-emerald-100 text-emerald-700',
];
function avatarColor(name: string): string {
  let h = 0; for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

interface TicketCardProps {
  ticket: KanbanTicket;
  onClick: (id: string) => void;
}

export function TicketCard({ ticket, onClick }: TicketCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ticket.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  const isDueSoon = ticket.dueDate
    ? new Date(ticket.dueDate).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000
    : false;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="mb-3">
      <div
        className="bg-card rounded-xl shadow-sm border border-transparent hover:border-primary/20 hover:shadow-md transition-all select-none p-4"
        onClick={() => onClick(ticket.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onClick(ticket.id)}
      >
        {/* Row 1: ticket ref + priority dot */}
        <div className="flex items-start justify-between mb-3">
          <span className="font-mono text-xs font-bold text-primary uppercase tracking-tight">
            {ticket.ticketRef}
          </span>
          <span
            className={`w-2 h-2 rounded-full shrink-0 mt-0.5 ${PRIORITY_DOTS[ticket.priority]}`}
            aria-label={`Priority ${ticket.priority}`}
          />
        </div>

        {/* Row 2: title */}
        <h4 className="text-sm font-semibold text-foreground mb-3 line-clamp-2 leading-snug">
          {ticket.subject}
        </h4>

        {/* Dashed divider */}
        <div className="border-b border-dashed border-border mb-3" />

        {/* Row 3: meta + assignee */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            {ticket.category ? (
              <span className="font-mono">{ticket.category.name}</span>
            ) : ticket.contactPhone ? (
              <span className="font-mono">{ticket.contactPhone}</span>
            ) : (
              <span className="font-mono">{ticket.contactName}</span>
            )}
          </div>
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border border-border ${avatarColor(ticket.contactName)}`}
          >
            {getInitials(ticket.contactName)}
          </div>
        </div>

        {/* Row 4: due date (conditional) */}
        {ticket.dueDate && (
          <div className={`mt-2.5 flex items-center gap-1 text-xs font-mono ${isDueSoon ? 'text-destructive' : 'text-muted-foreground'}`}>
            <CalendarClock className="h-3.5 w-3.5 shrink-0" />
            <span>Hết hạn: {format(new Date(ticket.dueDate), 'dd/MM/yyyy')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
