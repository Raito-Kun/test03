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
import { formatMoney } from '@/lib/format';
import { DEBT_TIERS, DEBT_STATUSES, type DebtTier, type DebtStatus } from '@shared/constants/enums';

interface DebtCase {
  id: string;
  totalAmount: number;
  paidAmount: number;
  tier: DebtTier;
  status: DebtStatus;
  dpd: number;
  createdAt: string;
  contact: { id: string; fullName: string } | null;
}

const TIER_COLORS: Record<DebtTier, string> = {
  current: 'bg-green-100 text-green-800',
  dpd_1_30: 'bg-yellow-100 text-yellow-800',
  dpd_31_60: 'bg-orange-100 text-orange-800',
  dpd_61_90: 'bg-red-100 text-red-800',
  dpd_90_plus: 'bg-red-200 text-red-900',
};

const STATUS_COLORS: Record<DebtStatus, string> = {
  active: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  promise_to_pay: 'bg-purple-100 text-purple-700',
  paid: 'bg-green-100 text-green-700',
  written_off: 'bg-gray-100 text-gray-700',
};

export default function DebtCaseListPage() {
  const navigate = useNavigate();
  const [tierFilter, setTierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const { page, setPage, limit, setLimit, search, setSearch, sortKey, sortOrder, handleSort, queryParams } = usePagination();

  const { data, isLoading } = useQuery({
    queryKey: ['debt-cases', queryParams, tierFilter, statusFilter],
    queryFn: async () => {
      const params: Record<string, string | number> = { ...queryParams };
      if (tierFilter) params.tier = tierFilter;
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/debt-cases', { params });
      return data.data as { items: DebtCase[]; total: number };
    },
  });

  const columns: Column<DebtCase>[] = [
    { key: 'contact', label: VI.contact.fullName, render: (row) => row.contact?.fullName ?? '—' },
    { key: 'totalAmount', label: VI.debt.amount, sortable: true, render: (row) => formatMoney(row.totalAmount) },
    { key: 'paidAmount', label: VI.debt.paidAmount, render: (row) => formatMoney(row.paidAmount) },
    { key: 'dpd', label: VI.debt.dpd, sortable: true },
    {
      key: 'tier', label: VI.debt.tier,
      render: (row) => <Badge className={TIER_COLORS[row.tier]}>{VI.debt.tiers[row.tier]}</Badge>,
    },
    {
      key: 'status', label: VI.debt.status,
      render: (row) => <Badge className={STATUS_COLORS[row.status]}>{VI.debt.statuses[row.status]}</Badge>,
    },
    {
      key: 'createdAt', label: VI.contact.createdAt, sortable: true,
      render: (row) => format(new Date(row.createdAt), 'dd/MM/yyyy'),
    },
  ];

  const toolbar = (
    <div className="flex gap-2">
      <Select value={tierFilter || 'all'} onValueChange={(v) => setTierFilter(!v || v === 'all' ? '' : v)}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder={VI.debt.tier} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{VI.actions.filter} — {VI.debt.tier}</SelectItem>
          {DEBT_TIERS.map((t) => (
            <SelectItem key={t} value={t}>{VI.debt.tiers[t]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(!v || v === 'all' ? '' : v)}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder={VI.debt.status} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{VI.actions.filter} — {VI.debt.status}</SelectItem>
          {DEBT_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>{VI.debt.statuses[s]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <PageWrapper title={VI.debt.title}>
      <DataTable<DebtCase>
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
        onRowClick={(row) => navigate(`/debt-cases/${row.id}`)}
        toolbar={toolbar}
      />
    </PageWrapper>
  );
}
