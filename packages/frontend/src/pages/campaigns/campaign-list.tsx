import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { RefreshCw, Users } from 'lucide-react';
import { PageWrapper } from '@/components/page-wrapper';
import { DataTable, type Column } from '@/components/data-table/data-table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { usePagination } from '@/hooks/use-pagination';
import api from '@/services/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { VI } from '@/lib/vi-text';
import { CAMPAIGN_STATUSES, CAMPAIGN_TYPES, type CampaignStatus, type CampaignType } from '@shared/constants/enums';
import { AutoAssignButton } from '@/components/auto-assign-dialog';
import { ExportButton } from '@/components/export-button';
import { toast } from 'sonner';

interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  totalLeads?: number;
  contactedLeads?: number;
}

const STATUS_COLORS: Record<CampaignStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-blue-100 text-blue-700',
};

export default function CampaignListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuthStore();
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { page, setPage, limit, setLimit, sortKey, sortOrder, handleSort, queryParams } = usePagination();

  const canAllocate = hasPermission('crm.data_allocation');

  function toggleSelect(id: string) {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function toggleSelectAll(rows: Campaign[]) {
    const allIds = rows.map((r) => r.id);
    const allSelected = allIds.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected ? selectedIds.filter((id) => !allIds.includes(id)) : [...new Set([...selectedIds, ...allIds])]);
  }

  function handleCampaignAllocate() {
    toast.info('Để phân bổ chiến dịch, vào chi tiết chiến dịch và dùng chức năng Tự động phân công.');
  }

  const { data, isLoading } = useQuery({
    queryKey: ['campaigns', queryParams, statusFilter, typeFilter, dateFrom, dateTo, appliedSearch],
    queryFn: async () => {
      const params: Record<string, string | number> = { ...queryParams, search: appliedSearch };
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.type = typeFilter;
      if (dateFrom) params.dateFrom = `${dateFrom}T00:00:00`;
      if (dateTo) params.dateTo = `${dateTo}T23:59:59`;
      const { data } = await api.get('/campaigns', { params });
      return data.data as { items: Campaign[]; total: number };
    },
  });

  const currentPageRows = data?.items ?? [];
  const allPageSelected = currentPageRows.length > 0 && currentPageRows.every((r) => selectedIds.includes(r.id));

  const columns: Column<Campaign>[] = [
    ...(canAllocate ? [{
      key: '_select',
      label: (
        <Checkbox
          checked={allPageSelected}
          onCheckedChange={() => toggleSelectAll(currentPageRows)}
          aria-label="Chọn tất cả"
        />
      ) as React.ReactNode,
      render: (row: Campaign) => (
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
    {
      key: 'totalLeads',
      label: 'Tiến độ',
      render: (row) => {
        const total = row.totalLeads ?? 0;
        const contacted = row.contactedLeads ?? 0;
        if (total === 0) return <span className="text-muted-foreground text-xs">—</span>;
        const pct = Math.round((contacted / total) * 100);
        const color = pct >= 80 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500';
        return (
          <div className="w-32">
            <div className="flex justify-between text-xs mb-1">
              <span>{contacted}/{total}</span>
              <span>{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      },
    },
    {
      key: 'id',
      label: '',
      render: (row) => (
        <div onClick={(e) => e.stopPropagation()}>
          <AutoAssignButton campaignId={row.id} campaignName={row.name} />
        </div>
      ),
    },
  ];

  const toolbar = (
    <div className="flex items-end gap-2 flex-wrap">
      <Select value={statusFilter || undefined} onValueChange={(v) => setStatusFilter(v === '_all' ? '' : v || '')}>
        <SelectTrigger className="w-40">
          {statusFilter
            ? <span>{VI.campaign.statuses[statusFilter as CampaignStatus]}</span>
            : <span className="text-muted-foreground">Tất cả trạng thái</span>}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Tất cả trạng thái</SelectItem>
          {CAMPAIGN_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>{VI.campaign.statuses[s]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={typeFilter || undefined} onValueChange={(v) => setTypeFilter(v === '_all' ? '' : v || '')}>
        <SelectTrigger className="w-36">
          {typeFilter
            ? <span>{VI.campaign.types[typeFilter as CampaignType]}</span>
            : <span className="text-muted-foreground">Tất cả loại</span>}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Tất cả loại</SelectItem>
          {CAMPAIGN_TYPES.map((t) => (
            <SelectItem key={t} value={t}>{VI.campaign.types[t]}</SelectItem>
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
      {(dateFrom || dateTo || statusFilter || typeFilter) && (
        <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); setStatusFilter(''); setTypeFilter(''); }}>Xóa lọc</Button>
      )}
    </div>
  );

  const allocateButton = canAllocate && selectedIds.length > 0 ? (
    <Button variant="outline" size="sm" onClick={handleCampaignAllocate} className="gap-1.5">
      <Users className="h-4 w-4" />
      Phân bổ ({selectedIds.length})
    </Button>
  ) : null;

  return (
    <PageWrapper title={VI.campaign.title} actions={
      <>
        {allocateButton}
        <Button variant="outline" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: ['campaigns'] })} title={VI.actions.refresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        <ExportButton entity="campaigns" filters={{ search: appliedSearch, status: statusFilter, type: typeFilter }} />
      </>
    }>
      <DataTable<Campaign>
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
        onRowClick={(row) => navigate(`/campaigns/${row.id}`)}
        toolbar={toolbar}
      />
    </PageWrapper>
  );
}
