import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DottedCard } from '@/components/ops/dotted-card';
import { DataTable, type Column } from '@/components/data-table/data-table';
import { Phone, RefreshCw, Users, Search, SlidersHorizontal, ChevronRight } from 'lucide-react';
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
  assignedTo: { id: string; fullName: string } | null;
}

// Stage segment groups — map status values to display groups
type StageGroup = 'all' | 'new' | 'processing' | 'won' | 'lost';
const STAGE_GROUPS: { key: StageGroup; label: string; statuses: LeadStatus[] }[] = [
  { key: 'all',        label: 'Tất cả',      statuses: LEAD_STATUSES as unknown as LeadStatus[] },
  { key: 'new',        label: 'Mới',          statuses: ['new'] },
  { key: 'processing', label: 'Đang xử lý',   statuses: ['contacted', 'qualified', 'proposal'] },
  { key: 'won',        label: 'Hoàn tất',     statuses: ['won'] },
  { key: 'lost',       label: 'Hủy',          statuses: ['lost'] },
];

// Status pill appearance
const STATUS_PILL: Record<LeadStatus, { pill: string; dot: string; label: string }> = {
  new:       { pill: 'bg-slate-100 text-slate-600 border border-slate-200',   dot: 'bg-slate-400',   label: 'Mới' },
  contacted: { pill: 'bg-amber-50 text-amber-700 border border-amber-100',    dot: 'bg-amber-400',   label: 'Đã liên hệ' },
  qualified: { pill: 'bg-emerald-50 text-emerald-700 border border-emerald-100', dot: 'bg-emerald-500', label: 'Tiềm năng' },
  proposal:  { pill: 'bg-violet-50 text-violet-700 border border-violet-100', dot: 'bg-violet-500',  label: 'Đề xuất' },
  won:       { pill: 'bg-emerald-50 text-emerald-800 border border-emerald-200', dot: 'bg-emerald-600', label: 'Hoàn tất' },
  lost:      { pill: 'bg-red-50 text-red-700 border border-red-100',          dot: 'bg-red-500',     label: 'Hủy' },
};

// Deterministic avatar bg color from name
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
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function LeadList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [stageGroup, setStageGroup] = useState<StageGroup>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [allocateOpen, setAllocateOpen] = useState(false);
  const { hasPermission, user } = useAuthStore();
  const myStatus = useAgentStatusStore((s) => s.myStatus);
  const { page, setPage, limit, setLimit, sortKey, sortOrder, handleSort, queryParams } = usePagination();

  const canAllocate = hasPermission('crm.data_allocation');

  // Derive status filter from stage group
  const activeStatuses = STAGE_GROUPS.find((g) => g.key === stageGroup)?.statuses ?? [];

  function toggleSelect(id: string) {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function toggleSelectAll(rows: Lead[]) {
    const allIds = rows.map((r) => r.id);
    const allSelected = allIds.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected
      ? selectedIds.filter((id) => !allIds.includes(id))
      : [...new Set([...selectedIds, ...allIds])]);
  }

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['leads', queryParams, stageGroup, sourceFilter, dateFrom, dateTo, appliedSearch],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        ...queryParams,
        search: appliedSearch,
        ...(sourceFilter && { source: sourceFilter }),
        ...(stageGroup !== 'all' && activeStatuses.length === 1 && { status: activeStatuses[0] }),
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
      label: 'HỌ TÊN',
      render: (row) => {
        const name = row.contact?.fullName;
        if (!name) return <span className="text-muted-foreground">—</span>;
        return (
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor(name)}`}>
              {getInitials(name)}
            </div>
            <span className="text-sm font-semibold">{name}</span>
          </div>
        );
      },
    },
    {
      key: 'phone',
      label: 'SĐT',
      render: (row) => {
        const phone = row.contact?.phone;
        if (!phone) return <span className="text-muted-foreground">—</span>;
        return (
          <span className="flex items-center gap-1.5">
            <span className="font-mono text-sm">{fmtPhone(phone)}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const blocked = checkCallBlocked(myStatus, user?.sipExtension);
                if (blocked) { toast.error(blocked); return; }
                api.post('/calls/originate', { phone })
                  .then(() => toast.success(`Đang gọi ${fmtPhone(phone)}...`))
                  .catch((err: { response?: { data?: { error?: { message?: string } } }; message?: string }) =>
                    toast.error(err?.response?.data?.error?.message || 'Không thể gọi'));
              }}
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
      key: 'source',
      label: 'NGUỒN',
      render: (row) => (
        <span className="text-sm">{row.source ? (LEAD_SOURCE_LABELS[row.source] ?? row.source) : '—'}</span>
      ),
    },
    {
      key: 'status',
      label: 'TRẠNG THÁI',
      render: (row) => {
        const s = STATUS_PILL[row.status];
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${s.pill}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            {s.label}
          </span>
        );
      },
    },
    {
      key: 'assignedTo',
      label: 'PHỤ TRÁCH',
      render: (row) => {
        const name = row.assignedTo?.fullName;
        if (!name) return <span className="text-muted-foreground">—</span>;
        return (
          <div className="flex items-center gap-2">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${avatarColor(name)}`}>
              {getInitials(name)}
            </div>
            <span className="text-xs font-medium">{name}</span>
          </div>
        );
      },
    },
    {
      key: 'createdAt',
      label: 'NGÀY TẠO',
      sortable: true,
      render: (row) => (
        <span className="font-mono text-xs text-muted-foreground">
          {format(new Date(row.createdAt), 'dd/MM/yyyy')}
        </span>
      ),
    },
  ];

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

  const importAction = hasPermission('crm.leads.import') ? (
    <ImportButton
      endpoint="/leads/import"
      templateType="leads"
      label="Nhập dữ liệu"
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
    <div className="space-y-4">
      {/* Breadcrumb + status pill */}
      <div className="flex items-center gap-3">
        <nav className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">Trang chủ</span>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-primary font-semibold">Khách hàng tiềm năng</span>
        </nav>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-1.5 bg-primary/10 px-2 py-0.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-bold text-primary tracking-wider font-mono">LEAD ACTIVE</span>
        </div>
      </div>

      {/* Search + action bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 rounded-xl bg-muted/40 border-border"
            placeholder="Tìm kiếm tên, số điện thoại, email..."
            value={appliedSearch}
            onChange={(e) => { setAppliedSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" className="gap-2 rounded-xl border-dashed" onClick={() => setFilterOpen((v) => !v)}>
            <SlidersHorizontal className="h-4 w-4" />
            Lọc
          </Button>
          {importAction ?? (
            <Button variant="secondary" className="gap-2 rounded-xl">
              Nhập dữ liệu
            </Button>
          )}
          <div className="flex items-center gap-1">
            {allocateButton}{refreshButton}
            <ExportButton entity="leads" filters={{ search: appliedSearch }} />
            <Button onClick={() => setShowForm(true)} className="rounded-xl">
              <span className="mr-1">+</span>Tạo lead
            </Button>
          </div>
        </div>
      </div>

      {/* Collapsible advanced filters */}
      {filterOpen && (
        <div className="flex items-end gap-2 flex-wrap p-3 rounded-xl border border-dashed border-border bg-muted/20">
          <div className="space-y-1">
            <Label className="text-xs">Nguồn</Label>
            <select
              value={sourceFilter}
              onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm w-36"
            >
              <option value="">Tất cả nguồn</option>
              {Object.entries(LEAD_SOURCE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
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
          {(dateFrom || dateTo || sourceFilter) && (
            <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); setSourceFilter(''); }}>
              Xóa lọc
            </Button>
          )}
        </div>
      )}

      {/* Stage segment chips */}
      <div className="flex items-center gap-2">
        {STAGE_GROUPS.map((g) => (
          <button
            key={g.key}
            onClick={() => { setStageGroup(g.key); setPage(1); }}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              stageGroup === g.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      <DottedCard>
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
        />
      </DottedCard>

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
    </div>
  );
}
