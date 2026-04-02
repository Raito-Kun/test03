import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { RefreshCw } from 'lucide-react';
import { VI } from '@/lib/vi-text';
import api from '@/services/api-client';
import { usePagination } from '@/hooks/use-pagination';
import { PageWrapper } from '@/components/page-wrapper';
import { DataTable, type Column } from '@/components/data-table/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import TicketForm from './ticket-form';
import { ExportButton } from '@/components/export-button';

const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

type TicketStatus = typeof TICKET_STATUSES[number];
type TicketPriority = typeof TICKET_PRIORITIES[number];

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

interface Ticket {
  id: string;
  contactName: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
}

export default function TicketListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const { page, setPage, limit, setLimit, search, setSearch, queryParams } = usePagination(20);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['tickets', queryParams, statusFilter, priorityFilter],
    queryFn: async () => {
      const params: Record<string, string | number> = { ...queryParams };
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      const { data } = await api.get('/tickets', { params });
      return data.data as { items: Ticket[]; total: number };
    },
  });

  const columns: Column<Ticket>[] = [
    { key: 'contactName', label: VI.contact.fullName },
    { key: 'category', label: VI.ticket.category },
    {
      key: 'priority',
      label: VI.ticket.priority,
      render: (row) => (
        <Badge className={PRIORITY_COLORS[row.priority]}>
          {VI.ticket.priorities[row.priority]}
        </Badge>
      ),
    },
    {
      key: 'status',
      label: VI.ticket.status,
      render: (row) => (
        <Badge className={STATUS_COLORS[row.status]}>
          {VI.ticket.statuses[row.status]}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      label: VI.contact.createdAt,
      render: (row) => format(new Date(row.createdAt), 'dd/MM/yyyy'),
    },
  ];

  const toolbar = (
    <div className="flex gap-2">
      <Select value={statusFilter || undefined} onValueChange={(v) => setStatusFilter(v === '_all' ? '' : v || '')}>
        <SelectTrigger className="w-40">
          {statusFilter
            ? <span>{VI.ticket.statuses[statusFilter as TicketStatus]}</span>
            : <span className="text-muted-foreground">Tất cả trạng thái</span>}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Tất cả trạng thái</SelectItem>
          {TICKET_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>{VI.ticket.statuses[s]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={priorityFilter || undefined} onValueChange={(v) => setPriorityFilter(v === '_all' ? '' : v || '')}>
        <SelectTrigger className="w-40">
          {priorityFilter
            ? <span>{VI.ticket.priorities[priorityFilter as TicketPriority]}</span>
            : <span className="text-muted-foreground">Tất cả mức độ</span>}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Tất cả mức độ</SelectItem>
          {TICKET_PRIORITIES.map((p) => (
            <SelectItem key={p} value={p}>{VI.ticket.priorities[p]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <PageWrapper title={VI.ticket.title} onCreate={() => setShowForm(true)} actions={
      <><Button variant="outline" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: ['tickets'] })} title={VI.actions.refresh}>
        <RefreshCw className="h-4 w-4" />
      </Button><ExportButton entity="tickets" filters={{ search: search || '', status: statusFilter, priority: priorityFilter }} /></>
    }>
      <DataTable
        columns={columns}
        data={data?.items ?? []}
        total={data?.total ?? 0}
        page={page}
        limit={limit}
        isLoading={isLoading}
        searchValue={search}
        onSearchChange={setSearch}
        onPageChange={setPage}
        onLimitChange={setLimit}
        onRowClick={(row) => navigate(`/tickets/${row.id}`)}
        toolbar={toolbar}
      />
      {showForm && (
        <TicketForm
          open={showForm}
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); refetch(); }}
        />
      )}
    </PageWrapper>
  );
}
