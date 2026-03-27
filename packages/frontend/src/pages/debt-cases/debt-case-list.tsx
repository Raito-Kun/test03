import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { PageWrapper } from '@/components/page-wrapper';
import { DataTable, type Column } from '@/components/data-table/data-table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Phone } from 'lucide-react';
import { toast } from 'sonner';
import { usePagination } from '@/hooks/use-pagination';
import api from '@/services/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { useAgentStatusStore } from '@/stores/agent-status-store';
import { VI } from '@/lib/vi-text';
import { formatMoney, fmtPhone, checkCallBlocked } from '@/lib/format';
import { DEBT_TIERS, DEBT_STATUSES, type DebtTier, type DebtStatus } from '@shared/constants/enums';

interface DebtCase {
  id: string;
  totalAmount: number;
  paidAmount: number;
  tier: DebtTier;
  status: DebtStatus;
  dpd: number;
  contractNumber: string | null;
  debtType: string | null;
  debtGroup: string | null;
  createdAt: string;
  contact: { id: string; fullName: string; phone: string } | null;
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
  const { user } = useAuthStore();
  const myStatus = useAgentStatusStore((s) => s.myStatus);
  const [tierFilter, setTierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const { page, setPage, limit, setLimit, sortKey, sortOrder, handleSort, queryParams } = usePagination();

  const { data, isLoading } = useQuery({
    queryKey: ['debt-cases', queryParams, tierFilter, statusFilter, dateFrom, dateTo, appliedSearch],
    queryFn: async () => {
      const params: Record<string, string | number> = { ...queryParams, search: appliedSearch };
      if (tierFilter) params.tier = tierFilter;
      if (statusFilter) params.status = statusFilter;
      if (dateFrom) params.dateFrom = `${dateFrom}T00:00:00`;
      if (dateTo) params.dateTo = `${dateTo}T23:59:59`;
      const { data } = await api.get('/debt-cases', { params });
      return data.data as { items: DebtCase[]; total: number };
    },
  });

  const columns: Column<DebtCase>[] = [
    { key: 'contact', label: VI.contact.fullName, render: (row) => row.contact?.fullName ?? '—' },
    {
      key: 'phone', label: VI.contact.phone,
      render: (row) => {
        const phone = row.contact?.phone;
        if (!phone) return '—';
        return (
          <span className="flex items-center gap-1.5">
            {fmtPhone(phone)}
            <button
              onClick={(e) => { e.stopPropagation(); const blocked = checkCallBlocked(myStatus, user?.sipExtension); if (blocked) { toast.error(blocked); return; } api.post('/calls/originate', { phone }).then(() => toast.success(`Đang gọi ${fmtPhone(phone)}...`)).catch((err: { response?: { data?: { error?: { message?: string } } }; message?: string }) => toast.error(err?.response?.data?.error?.message || 'Không thể gọi')); }}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
              title="Gọi"
            >
              <Phone className="h-3 w-3" />
            </button>
          </span>
        );
      },
    },
    { key: 'totalAmount', label: VI.debt.amount, sortable: true, render: (row) => formatMoney(row.totalAmount) },
    { key: 'paidAmount', label: VI.debt.paidAmount, render: (row) => formatMoney(row.paidAmount) },
    { key: 'contractNumber', label: VI.debt.contractNumber, render: (row) => row.contractNumber ?? '—' },
    { key: 'debtType', label: VI.debt.debtType, render: (row) => row.debtType ?? '—' },
    { key: 'dpd', label: VI.debt.dpd, sortable: true },
    { key: 'debtGroup', label: VI.debt.debtGroup, render: (row) => row.debtGroup ? `Nhóm ${row.debtGroup}` : '—' },
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
    <div className="flex items-end gap-2 flex-wrap">
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
      <div className="space-y-1">
        <Label className="text-xs">Từ ngày</Label>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Đến ngày</Label>
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" />
      </div>
      {(dateFrom || dateTo || tierFilter || statusFilter) && (
        <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); setTierFilter(''); setStatusFilter(''); }}>Xóa lọc</Button>
      )}
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
        onSearchSubmit={(v) => { setAppliedSearch(v); setPage(1); }}
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
