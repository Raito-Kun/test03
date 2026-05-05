import { useState } from 'react';
import type React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Filter, MoreHorizontal, RefreshCw, Users } from 'lucide-react';
import { DataTable, type Column } from '@/components/data-table/data-table';
import { DottedCard } from '@/components/ops/dotted-card';
import CampaignCreateDialog from './campaign-create-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  agents?: { user: { id: string; fullName: string } }[];
}

// Status pill with leading dot — consistent with campaign-detail.tsx STATUS_CONFIG
const STATUS_CONFIG: Record<CampaignStatus, { dot: string; bg: string; text: string; label: string }> = {
  draft:     { dot: 'bg-amber-500',            bg: 'bg-amber-50',           text: 'text-amber-700',           label: 'Bản nháp' },
  active:    { dot: 'bg-green-500',            bg: 'bg-green-100',          text: 'text-green-700',           label: 'Đang chạy' },
  paused:    { dot: 'bg-amber-400',            bg: 'bg-amber-50',           text: 'text-amber-700',           label: 'Tạm dừng' },
  completed: { dot: 'bg-muted-foreground',     bg: 'bg-muted',              text: 'text-muted-foreground',    label: 'Đã kết thúc' },
};

function StatusPill({ status }: { status: CampaignStatus }) {
  const c = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

// Derive two-letter initials
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_COLORS = [
  'bg-indigo-100 text-indigo-700',
  'bg-pink-100 text-pink-700',
  'bg-amber-100 text-amber-700',
  'bg-emerald-100 text-emerald-700',
  'bg-violet-100 text-violet-700',
  'bg-cyan-100 text-cyan-700',
];
function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// Segment chips — maps to status filter value ('' = all)
type SegmentKey = '' | 'active' | 'paused' | 'completed' | 'draft';
const SEGMENTS: { key: SegmentKey; label: string }[] = [
  { key: '',          label: 'Tất cả' },
  { key: 'active',    label: 'Đang chạy' },
  { key: 'paused',    label: 'Tạm dừng' },
  { key: 'completed', label: 'Đã kết thúc' },
  { key: 'draft',     label: 'Bản nháp' },
];

// Date range formatter: "01/10 – 31/12"
function fmtDateRange(start: string | null, end: string | null): string {
  const fmt = (s: string) => {
    const d = new Date(s);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `Từ ${fmt(start)}`;
  if (end) return `Đến ${fmt(end)}`;
  return '—';
}

export default function CampaignListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuthStore();
  const [statusFilter, setStatusFilter] = useState<SegmentKey>('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showAdvFilter, setShowAdvFilter] = useState(false);
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
    {
      key: 'name',
      label: 'TÊN CHIẾN DỊCH',
      sortable: true,
      render: (row) => (
        <div className="space-y-0.5">
          <p className="text-sm font-semibold leading-tight">{row.name}</p>
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
            CMP-{row.id.slice(0, 8).toUpperCase()}
          </p>
        </div>
      ),
    },
    {
      key: 'totalLeads',
      label: 'TIẾN ĐỘ',
      render: (row) => {
        const total = row.totalLeads ?? 0;
        const contacted = row.contactedLeads ?? 0;
        if (total === 0) return <span className="text-muted-foreground text-xs font-mono">—</span>;
        const pct = Math.round((contacted / total) * 100);
        return (
          <div className="w-28 space-y-1">
            <div className="flex justify-between items-center">
              <span className="font-mono text-[10px] text-muted-foreground">{contacted}/{total}</span>
              <span className="font-mono text-[10px] font-bold text-primary">{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      },
    },
    {
      key: 'agents',
      label: 'AGENTS',
      render: (row) => {
        const agents = row.agents ?? [];
        if (agents.length === 0) return <span className="text-muted-foreground text-xs font-mono">—</span>;
        const visible = agents.slice(0, 3);
        const extra = agents.length - visible.length;
        return (
          <div className="flex items-center -space-x-2">
            {visible.map((a) => (
              <div
                key={a.user.id}
                title={a.user.fullName}
                className={`w-6 h-6 rounded-full border-2 border-background flex items-center justify-center text-[9px] font-bold shrink-0 ${avatarColor(a.user.fullName)}`}
              >
                {getInitials(a.user.fullName)}
              </div>
            ))}
            {extra > 0 && (
              <div className="w-6 h-6 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground shrink-0">
                +{extra}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      label: 'TRẠNG THÁI',
      render: (row) => <StatusPill status={row.status} />,
    },
    {
      key: 'startDate',
      label: 'NGÀY',
      render: (row) => (
        <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">
          {fmtDateRange(row.startDate, row.endDate)}
        </span>
      ),
    },
    {
      key: 'id',
      label: '',
      render: (row) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <AutoAssignButton campaignId={row.id} campaignName={row.name} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/campaigns/${row.id}`)}>
                Xem chi tiết
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Breadcrumb + CTA */}
      <div className="flex items-center justify-between gap-4">
        <nav className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">Trang chủ</span>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-primary font-semibold">Chiến dịch</span>
        </nav>
        <CampaignCreateDialog />
      </div>

      {/* Segment chips + right actions */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {SEGMENTS.map((seg) => (
            <button
              key={seg.key}
              onClick={() => { setStatusFilter(seg.key); setPage(1); }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                statusFilter === seg.key
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'bg-card border border-border text-muted-foreground hover:border-primary hover:text-primary'
              }`}
            >
              {seg.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-dashed"
            onClick={() => setShowAdvFilter((v) => !v)}
          >
            <Filter className="h-4 w-4" />
            Lọc nâng cao
          </Button>
          {canAllocate && selectedIds.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleCampaignAllocate} className="gap-1.5">
              <Users className="h-4 w-4" />
              Phân bổ ({selectedIds.length})
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['campaigns'] })}
            title={VI.actions.refresh}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <ExportButton entity="campaigns" filters={{ search: appliedSearch, status: statusFilter, type: typeFilter }} />
        </div>
      </div>

      {/* Advanced filters (collapsible) */}
      {showAdvFilter && (
        <div className="bg-card border border-dashed border-border rounded-xl p-4 flex items-end gap-3 flex-wrap">
          <div className="space-y-1">
            <Label className="text-xs">Loại chiến dịch</Label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="flex h-9 w-44 rounded-md border border-border bg-background px-3 py-1 text-sm"
            >
              <option value="">Tất cả loại</option>
              {CAMPAIGN_TYPES.map((t) => (
                <option key={t} value={t}>{VI.campaign.types[t]}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Từ ngày</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Đến ngày</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" />
          </div>
          {(dateFrom || dateTo || typeFilter) && (
            <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); setTypeFilter(''); }}>
              Xóa lọc
            </Button>
          )}
        </div>
      )}

      {/* Table */}
      <DottedCard>
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
        />
      </DottedCard>
    </div>
  );
}
