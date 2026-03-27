import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageWrapper } from '@/components/page-wrapper';
import { DataTable, type Column } from '@/components/data-table/data-table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone } from 'lucide-react';
import { toast } from 'sonner';
import { usePagination } from '@/hooks/use-pagination';
import api from '@/services/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { useAgentStatusStore } from '@/stores/agent-status-store';
import { ImportButton } from '@/components/import-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { VI } from '@/lib/vi-text';
import { fmtPhone, checkCallBlocked } from '@/lib/format';
import { LEAD_STATUSES, type LeadStatus } from '@shared/constants/enums';
import { format } from 'date-fns';
import LeadForm from './lead-form';

interface Lead {
  id: string;
  status: LeadStatus;
  score: number | null;
  leadScore: number | null;
  product: string | null;
  budget: string | null;
  notes: string | null;
  followUpDate: string | null;
  createdAt: string;
  contact: { id: string; fullName: string; phone: string } | null;
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
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const { hasPermission, user } = useAuthStore();
  const myStatus = useAgentStatusStore((s) => s.myStatus);
  const { page, setPage, limit, setLimit, sortKey, sortOrder, handleSort, queryParams } = usePagination();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['leads', queryParams, statusFilter, dateFrom, dateTo, appliedSearch],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        ...queryParams,
        search: appliedSearch,
        ...(statusFilter !== 'all' && { status: statusFilter }),
      };
      if (dateFrom) params.dateFrom = `${dateFrom}T00:00:00`;
      if (dateTo) params.dateTo = `${dateTo}T23:59:59`;
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
      key: 'phone',
      label: VI.contact.phone,
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
      key: 'leadScore',
      label: VI.lead.leadScore,
      sortable: true,
      render: (row) => row.leadScore ?? '—',
    },
    {
      key: 'product',
      label: VI.lead.product,
      render: (row) => row.product ?? '—',
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
    <div className="flex items-end gap-2">
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
      <div className="space-y-1">
        <Label className="text-xs">Từ ngày</Label>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Đến ngày</Label>
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" />
      </div>
      {(dateFrom || dateTo) && (
        <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>Xóa lọc</Button>
      )}
    </div>
  );

  const importAction = hasPermission('import_leads') ? (
    <ImportButton
      endpoint="/leads/import"
      templateType="leads"
      label="Nhập CSV"
      invalidateKeys={['leads']}
    />
  ) : undefined;

  return (
    <PageWrapper
      title={VI.lead.title}
      createLabel={VI.actions.create}
      onCreate={() => setShowForm(true)}
      actions={importAction}
    >
      <DataTable<Lead>
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
