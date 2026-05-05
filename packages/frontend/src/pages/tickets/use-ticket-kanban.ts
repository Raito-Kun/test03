import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api-client';

export const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
export type TicketStatus = typeof TICKET_STATUSES[number];
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface KanbanTicket {
  id: string;
  ticketRef: string; // display ref e.g. "#TK-0042"
  contactName: string;
  contactPhone: string;
  agentExt: string;
  priority: TicketPriority;
  status: TicketStatus;
  subject: string;
  createdAt: string;
  dueDate?: string | null;
  category?: { id: string; name: string } | null;
  recordingPath?: string | null;
}

type GroupedTickets = Record<TicketStatus, KanbanTicket[]>;

function groupByStatus(tickets: KanbanTicket[]): GroupedTickets {
  const groups: GroupedTickets = { open: [], in_progress: [], resolved: [], closed: [] };
  for (const t of tickets) {
    if (groups[t.status]) groups[t.status].push(t);
    else groups.open.push(t);
  }
  return groups;
}

export function useTicketKanban(priorityFilter: string, searchQuery: string) {
  const queryClient = useQueryClient();
  const [collapseClosed, setCollapseClosed] = useState(true);

  const { data: tickets = [], isLoading } = useQuery<KanbanTicket[]>({
    queryKey: ['tickets-kanban'],
    queryFn: async () => {
      const { data } = await api.get('/tickets', { params: { limit: 200, page: 1 } });
      // Backend returns tickets with nested contact/user/callLog — flatten here so
      // the kanban card and filter logic can stay simple and schema-agnostic.
      interface RawTicket {
        id: string;
        subject: string;
        status: TicketStatus;
        priority: TicketPriority;
        createdAt: string;
        dueDate?: string | null;
        category?: { id: string; name: string } | null;
        contact?: { fullName?: string; phone?: string } | null;
        user?: { extension?: string } | null;
        callLog?: { recordingPath?: string | null } | null;
      }
      const raw = (data.data ?? []) as RawTicket[];
      return raw.map((t, idx) => ({
        id: t.id,
        ticketRef: `#TK-${String(idx + 1).padStart(4, '0')}`,
        subject: t.subject,
        status: t.status,
        priority: t.priority,
        createdAt: t.createdAt,
        dueDate: t.dueDate ?? null,
        category: t.category ?? null,
        contactName: t.contact?.fullName ?? '—',
        contactPhone: t.contact?.phone ?? '',
        agentExt: t.user?.extension ?? '',
        recordingPath: t.callLog?.recordingPath ?? null,
      }));
    },
    staleTime: 30_000,
  });

  const filtered = tickets.filter((t) => {
    const matchPriority = !priorityFilter || t.priority === priorityFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      t.contactName.toLowerCase().includes(q) ||
      (t.contactPhone ?? '').toLowerCase().includes(q) ||
      (t.agentExt ?? '').toLowerCase().includes(q);
    return matchPriority && matchSearch;
  });

  const grouped = groupByStatus(filtered);

  const moveTicket = useCallback(
    async (ticketId: string, newStatus: TicketStatus) => {
      // Optimistic update
      queryClient.setQueryData<KanbanTicket[]>(['tickets-kanban'], (prev) => {
        if (!prev) return prev;
        return prev.map((t) => (t.id === ticketId ? { ...t, status: newStatus } : t));
      });

      try {
        await api.patch(`/tickets/${ticketId}`, { status: newStatus });
      } catch {
        // Rollback
        queryClient.invalidateQueries({ queryKey: ['tickets-kanban'] });
      }
    },
    [queryClient],
  );

  return { grouped, isLoading, collapseClosed, setCollapseClosed, moveTicket };
}
