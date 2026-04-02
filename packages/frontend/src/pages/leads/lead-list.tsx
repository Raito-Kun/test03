import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageWrapper } from '@/components/page-wrapper';
import { DataTable, type Column } from '@/components/data-table/data-table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Phone, RefreshCw, Users } from 'lucide-react';
import { toast } from 'sonner';
import { usePagination } from '@/hooks/use-pagination';
import api from '@/services/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { useAgentStatusStore } from '@/stores/agent-status-store';
import { ImportButton } from '@/components/import-button';
import { ExportButton } from '@/components/export-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { VI } from '@/lib/vi-text';
import { fmtPhone, checkCallBlocked } from '@/lib/format';
import { LEAD_STATUSES, type LeadStatus } from '@shared/constants/enums';
import { format } from 'date-fns';
import LeadForm from './lead-form';
import { DataAllocationDialog } from '@/components/data-allocation-dialog';

const LEAD_SOURCE_LABELS: Record<string, string> = {
  website: 'Website',
  referral: 'Giới thiệu',
  phone: 'Điện thoại',
  email: 'Email',
  social: 'Mạng xã hội',
  other: 'Khác',
};

interface Lead {
  id: string;
  status: LeadStatus;
  score: number | null;
  leadScore: number | null;
  source: string | null;
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
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [allocateOpen, setAllocateOpen] = useState(false);
  const { hasPermission, user } = useAuthStore();
  const myStatus = useAgentStatusStore((s) => s.myStatus);
  const { page, setPage, limit, setLimit, sortKey, sortOrder, handleSort, queryParams } = usePagination();

  const canAllocate = hasPermission('crm.data_allocation');

  function toggleSelect(id: string) {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function toggleSelectAll(rows: Lead[]) {
    const allIds = rows.map((r) => r.id);
    const allSelected = allIds.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected ? selectedIds.filter((id) => !allIds.includes(id)) : [...new Set([...selectedIds, ...allIds])]);
  }

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['leads', queryParams, statusFilter, sourceFilter, dateFrom, dateTo, appliedSearch],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        ...queryParams,
        search: appliedSearch,
        ...(statusFilter && { status: statusFilter }),
        ...(sourceFilter && { source: sourceFilter }),
      };
      if (dateFrom) params.dateFrom = `${dateFrom}T00:00:00`;
      if (dateTo) params.dateTo = `${dateTo}T23:59:59`;
      const { data } = await api.get('/leads', { params });
      return data.data as { items: Lead[]; total: number };
    },
  });

  const currentPageRows = data?.items ?? [];
  const allPageSelected = currentPageRows.length > 0 && currentPageRows.every((r) => selectedIds.includes(r.id));

  const columns: Column<Lead>[] = [
    ...(canAllocate ? [{
      key: '_select',
      label: (
        <Checkbox
          checked={allPageSelected}
          onCheckedChange={() => toggleSelectAll(currentPageRows)}
          aria-label="Chọn tất cả"
        />
      ) as React.ReactNode,
      render: (row: Lead) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selectedIds.includes(row.id)}
            onCheckedChange={() => toggleSelect(row.id)}
            aria-label="Chọn"
          />
        </span>
      ),
      className: 'w-10',
    }] : []),
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
      render: (row) => {
        const score = row.leadScore ?? row.score;
        if (score == null) return <span className="text-muted-foreground">—</span>;
        const color = score >= 70 ? 'bg-green-100 text-green-800' : score >= 40 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';
        return <Badge className={color}>{score}</Badge>;
      },
    },
    {
      key: 'source',
      label: 'Nguồn',
      render: (row) => row.source ? (LEAD_SOURCE_LABELS[row.source] ?? row.source) : '—',
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
    <div className="flex items-end gap-2 flex-wrap">
      <Select value={statusFilter || undefined} onValueChange={(v) => { setStatusFilter(v === '_all' ? '' : v || ''); setPage(1); }}>
        <SelectTrigger className="w-44">
          {statusFilter
            ? <span>{VI.lead.statuses[statusFilter as LeadStatus]}</span>
            : <span className="text-muted-foreground">Tất cả trạng thái</span>}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Tất cả trạng thái</SelectItem>
          {LEAD_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>{VI.lead.statuses[s]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={sourceFilter || undefined} onValueChange={(v) => { setSourceFilter(v === '_all' ? '' : v || ''); setPage(1); }}>
        <SelectTrigger className="w-40">
          {sourceFilter
            ? <span>{LEAD_SOURCE_LABELS[sourceFilter] ?? sourceFilter}</span>
            : <span className="text-muted-foreground">Tất cả nguồn</span>}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Tất cả nguồn</SelectItem>
          {Object.entries(LEAD_SOURCE_LABELS).map(([v, l]) => (
            <SelectItem key={v} value={v}>{l}</SelectItem>
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
      {(dateFrom || dateTo || sourceFilter) && (
        <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); setSourceFilter(''); }}>Xóa lọc</Button>
      )}
    </div>
  );

  const refreshButton = (
    <Button
      variant="outline"
      size="icon"
      onClick={() => queryClient.invalidateQueries({ queryKey: ['leads'] })}
      title={VI.actions.refresh}
    >
      <RefreshCw className="h-4 w-4" />
    </Button>
  );

  const importAction = hasPermission('import_leads') ? (
    <ImportButton
      endpoint="/leads/import"
      templateType="leads"
      label="Nhập CSV"
      invalidateKeys={['leads']}
    />
  ) : undefined;

  const allocateButton = canAllocate && selectedIds.length > 0 ? (
    <Button variant="outline" size="sm" onClick={() => setAllocateOpen(true)} className="gap-1.5">
      <Users className="h-4 w-4" />
      Phân bổ ({selectedIds.length})
    </Button>
  ) : null;

  return (
    <PageWrapper
      title={VI.lead.title}
      createLabel={VI.actions.create}
      onCreate={() => setShowForm(true)}
      actions={<>{allocateButton}{refreshButton}{importAction}<ExportButton entity="leads" filters={{ search: appliedSearch, status: statusFilter }} /></>}
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

      <DataAllocationDialog
        open={allocateOpen}
        onClose={() => setAllocateOpen(false)}
        entityType="lead"
        selectedIds={selectedIds}
        onSuccess={() => {
          setSelectedIds([]);
          queryClient.invalidateQueries({ queryKey: ['leads'] });
        }}
      />
    </PageWrapper>
  );
}
