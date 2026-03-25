import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { PageWrapper } from '@/components/page-wrapper';
import { DataTable, type Column } from '@/components/data-table/data-table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePagination } from '@/hooks/use-pagination';
import api from '@/services/api-client';
import { VI } from '@/lib/vi-text';
import { CAMPAIGN_STATUSES, CAMPAIGN_TYPES, type CampaignStatus, type CampaignType } from '@shared/constants/enums';

interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
}

const STATUS_COLORS: Record<CampaignStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-blue-100 text-blue-700',
};

export default function CampaignListPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const { page, setPage, limit, setLimit, search, setSearch, sortKey, sortOrder, handleSort, queryParams } = usePagination();

  const { data, isLoading } = useQuery({
    queryKey: ['campaigns', queryParams, statusFilter, typeFilter],
    queryFn: async () => {
      const params: Record<string, string | number> = { ...queryParams };
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.type = typeFilter;
      const { data } = await api.get('/campaigns', { params });
      return data.data as { items: Campaign[]; total: number };
    },
  });

  const columns: Column<Campaign>[] = [
    { key: 'name', label: VI.campaign.name, sortable: true },
    {
      key: 'type', label: VI.campaign.type,
      render: (row) => <Badge variant="outline">{VI.campaign.types[row.type]}</Badge>,
    },
    {
      key: 'status', label: VI.campaign.status,
      render: (row) => <Badge className={STATUS_COLORS[row.status]}>{VI.campaign.statuses[row.status]}</Badge>,
    },
    {
      key: 'startDate', label: VI.campaign.startDate,
      render: (row) => row.startDate ? format(new Date(row.startDate), 'dd/MM/yyyy') : '—',
    },
    {
      key: 'endDate', label: VI.campaign.endDate,
      render: (row) => row.endDate ? format(new Date(row.endDate), 'dd/MM/yyyy') : '—',
    },
  ];

  const toolbar = (
    <div className="flex gap-2">
      <Select value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(!v || v === 'all' ? '' : v)}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder={VI.campaign.status} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{VI.actions.filter} — {VI.campaign.status}</SelectItem>
          {CAMPAIGN_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>{VI.campaign.statuses[s]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={typeFilter || 'all'} onValueChange={(v) => setTypeFilter(!v || v === 'all' ? '' : v)}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder={VI.campaign.type} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{VI.actions.filter} — {VI.campaign.type}</SelectItem>
          {CAMPAIGN_TYPES.map((t) => (
            <SelectItem key={t} value={t}>{VI.campaign.types[t]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <PageWrapper title={VI.campaign.title}>
      <DataTable<Campaign>
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
        onRowClick={(row) => navigate(`/campaigns/${row.id}`)}
        toolbar={toolbar}
      />
    </PageWrapper>
  );
}
