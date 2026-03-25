import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageWrapper } from '@/components/page-wrapper';
import { DataTable, type Column } from '@/components/data-table/data-table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePagination } from '@/hooks/use-pagination';
import api from '@/services/api-client';
import { VI } from '@/lib/vi-text';
import { LEAD_STATUSES, type LeadStatus } from '@shared/constants/enums';
import { format } from 'date-fns';
import LeadForm from './lead-form';

interface Lead {
  id: string;
  status: LeadStatus;
  score: number | null;
  notes: string | null;
  followUpDate: string | null;
  createdAt: string;
  contact: { id: string; fullName: string } | null;
  campaign: { id: string; name: string } | null;
}

const STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  qualified: 'bg-green-100 text-green-800',
  proposal: 'bg-purple-100 text-purple-800',
  won: 'bg-emerald-100 text-emerald-800',
  lost: 'bg-red-100 text-red-800',
};

export default function LeadList() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const { page, setPage, limit, setLimit, search, setSearch, sortKey, sortOrder, handleSort, queryParams } = usePagination();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['leads', queryParams, statusFilter],
    queryFn: async () => {
      const params = {
        ...queryParams,
        ...(statusFilter !== 'all' && { status: statusFilter }),
      };
      const { data } = await api.get('/leads', { params });
      return data.data as { items: Lead[]; total: number };
    },
  });

  const columns: Column<Lead>[] = [
    {
      key: 'contact',
      label: VI.contact.fullName,
      render: (row) => row.contact?.fullName ?? '—',
    },
    {
      key: 'status',
      label: VI.lead.status,
      render: (row) => (
        <Badge className={STATUS_COLORS[row.status]}>
          {VI.lead.statuses[row.status]}
        </Badge>
      ),
    },
    {
      key: 'score',
      label: VI.lead.score,
      sortable: true,
      render: (row) => row.score ?? '—',
    },
    {
      key: 'campaign',
      label: VI.lead.campaign,
      render: (row) => row.campaign?.name ?? '—',
    },
    {
      key: 'createdAt',
      label: VI.contact.createdAt,
      sortable: true,
      render: (row) => format(new Date(row.createdAt), 'dd/MM/yyyy HH:mm'),
    },
  ];

  const toolbar = (
    <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v ?? 'all'); setPage(1); }}>
      <SelectTrigger className="w-44">
        <SelectValue placeholder={VI.lead.status} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{VI.actions.filter} {VI.lead.status}</SelectItem>
        {LEAD_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>{VI.lead.statuses[s]}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <PageWrapper
      title={VI.lead.title}
      createLabel={VI.actions.create}
      onCreate={() => setShowForm(true)}
    >
      <DataTable<Lead>
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
        onSort={handleSort}
        sortKey={sortKey}
        sortOrder={sortOrder}
        onRowClick={(row) => navigate(`/leads/${row.id}`)}
        toolbar={toolbar}
      />
      {showForm && (
        <LeadForm
          open={showForm}
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); refetch(); }}
        />
      )}
    </PageWrapper>
  );
}
