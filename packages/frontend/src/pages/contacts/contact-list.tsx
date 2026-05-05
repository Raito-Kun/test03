import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { MoreHorizontal, Trash2, Phone, Edit2, RefreshCw, Users, Search, SlidersHorizontal, Upload, ChevronRight } from 'lucide-react';
import { ExportButton } from '@/components/export-button';
import { ContactMergeButton } from './contact-merge-dialog';
import { toast } from 'sonner';
import { DottedCard } from '@/components/ops/dotted-card';
import { DataTable, Column } from '@/components/data-table/data-table';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { VI } from '@/lib/vi-text';
import { fmtPhone, checkCallBlocked } from '@/lib/format';
import { usePagination } from '@/hooks/use-pagination';
import api from '@/services/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { useAgentStatusStore } from '@/stores/agent-status-store';
import { ContactImportWizardButton } from './contact-import-wizard';
import { ContactForm } from './contact-form';
import { ContactDetailDialog } from './contact-detail-dialog';
import { DataAllocationDialog } from '@/components/data-allocation-dialog';

interface Contact {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  company?: string;
  tags?: string[];
  // Backend returns BOTH — the raw FK id and the resolved user object.
  // Previously only `assignedTo: { fullName }` was typed which collided
  // with the string FK and rendered '—' for every row. Keep both now
  // so the column render can use the joined name and the allocation
  // dialog can detect 'already assigned' state.
  assignedTo?: string | null;
  assignedUser?: { id: string; fullName: string } | null;
  createdAt: string;
}

// Derive two-letter initials from a full name (e.g. "Nguyễn Văn Linh" → "NL")
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Deterministic avatar bg color from name string
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

// Segment pill style mapped from tag value
function segmentPill(tag: string) {
  const lower = tag.toLowerCase();
  if (lower === 'vip')
    return 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 text-xs font-semibold border border-violet-100';
  if (lower === 'mới' || lower === 'new')
    return 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold border border-slate-200';
  if (lower === 'tiềm năng' || lower === 'tiem nang')
    return 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 text-xs font-semibold border border-orange-100';
  // Default: muted pill
  return 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-semibold';
}
function segmentDotColor(tag: string): string {
  const lower = tag.toLowerCase();
  if (lower === 'vip') return 'bg-violet-500';
  if (lower === 'mới' || lower === 'new') return 'bg-slate-400';
  if (lower === 'tiềm năng' || lower === 'tiem nang') return 'bg-orange-500';
  return 'bg-muted-foreground';
}

interface ContactsResponse {
  data: Contact[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export default function ContactListPage() {
  const queryClient = useQueryClient();
  const pagination = usePagination();
  const { hasPermission, user } = useAuthStore();
  const myStatus = useAgentStatusStore((s) => s.myStatus);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [allocateOpen, setAllocateOpen] = useState(false);

  const canAllocate = hasPermission('crm.data_allocation');

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleSelectAll(rows: Contact[]) {
    const allIds = rows.map((r) => r.id);
    const allSelected = allIds.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected ? selectedIds.filter((id) => !allIds.includes(id)) : [...new Set([...selectedIds, ...allIds])]);
  }

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', pagination.queryParams, dateFrom, dateTo, appliedSearch, sourceFilter, tagFilter],
    queryFn: () => {
      const params: Record<string, string | number> = { ...pagination.queryParams, search: appliedSearch };
      if (dateFrom) params.dateFrom = `${dateFrom}T00:00:00`;
      if (dateTo) params.dateTo = `${dateTo}T23:59:59`;
      if (sourceFilter) params.source = sourceFilter;
      if (tagFilter) params.tag = tagFilter;
      return api.get<ContactsResponse>('/contacts', { params }).then((r) => r.data);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/contacts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setDeleteTarget(null);
      toast.success('Đã xóa liên hệ');
    },
    onError: () => toast.error('Xóa thất bại'),
  });

  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) =>
      api.post<{ data: { deleted: number; errors: Array<{ id: string; error: string }> } }>(
        '/contacts/bulk-delete', { ids },
      ).then((r) => r.data.data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setBulkDeleteOpen(false);
      setSelectedIds([]);
      const msg = `Đã xóa ${result.deleted} liên hệ`;
      if (result.errors?.length > 0) {
        toast.warning(msg, {
          description: `${result.errors.length} bản ghi lỗi: ${result.errors.slice(0, 2).map((e) => e.error).join('; ')}`,
          duration: 8000,
        });
      } else {
        toast.success(msg);
      }
    },
    onError: (err: { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(err?.response?.data?.error?.message || 'Xóa hàng loạt thất bại');
    },
  });

  const canBulkDelete = ['super_admin', 'admin', 'manager'].includes(user?.role ?? '');

  const currentPageRows = data?.data ?? [];
  const allPageSelected = currentPageRows.length > 0 && currentPageRows.every((r) => selectedIds.includes(r.id));

  const columns: Column<Contact>[] = [
    ...(canAllocate ? [{
      key: '_select',
      label: (
        <Checkbox
          checked={allPageSelected}
          onCheckedChange={() => toggleSelectAll(currentPageRows)}
          aria-label="Chọn tất cả"
        />
      ) as React.ReactNode,
      render: (row: Contact) => (
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
      key: 'fullName',
      label: 'HỌ TÊN',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor(row.fullName)}`}>
            {getInitials(row.fullName)}
          </div>
          <span className="text-sm font-semibold">{row.fullName}</span>
        </div>
      ),
    },
    {
      key: 'phone', label: 'SĐT',
      render: (row) => (
        <span className="flex items-center gap-1.5">
          <span className="font-mono text-sm">{fmtPhone(row.phone)}</span>
          <button
            onClick={(e) => { e.stopPropagation(); const blocked = checkCallBlocked(myStatus, user?.sipExtension); if (blocked) { toast.error(blocked); return; } api.post('/calls/originate', { phone: row.phone }).then(() => toast.success(`Đang gọi ${fmtPhone(row.phone)}...`)).catch((err) => toast.error(err?.response?.data?.error?.message || err?.message || 'Không thể gọi')); }}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
            title="Gọi"
          >
            <Phone className="h-3 w-3" />
          </button>
        </span>
      ),
    },
    {
      key: 'company',
      label: 'CÔNG TY',
      render: (row) => <span className="text-sm">{row.company || '—'}</span>,
    },
    {
      key: 'tags',
      label: 'PHÂN KHÚC',
      render: (row) => {
        const firstTag = row.tags?.[0];
        if (!firstTag) return <span className="text-muted-foreground">—</span>;
        return (
          <span className={segmentPill(firstTag)}>
            <span className={`w-1.5 h-1.5 rounded-full ${segmentDotColor(firstTag)}`} />
            {firstTag}
          </span>
        );
      },
    },
    {
      key: 'assignedTo',
      label: 'PHỤ TRÁCH',
      render: (row) => {
        const name = row.assignedUser?.fullName;
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
      onClick={() => queryClient.invalidateQueries({ queryKey: ['contacts'] })}
      title={VI.actions.refresh}
    >
      <RefreshCw className="h-4 w-4" />
    </Button>
  );

  const importAction = ['super_admin', 'admin', 'manager', 'leader'].includes(user?.role ?? '')
    ? <ContactImportWizardButton />
    : undefined;

  const allocateButton = canAllocate && selectedIds.length > 0 ? (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setAllocateOpen(true)}
      className="gap-1.5"
    >
      <Users className="h-4 w-4" />
      Phân bổ ({selectedIds.length})
    </Button>
  ) : null;

  const bulkDeleteButton = canBulkDelete && selectedIds.length > 0 ? (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setBulkDeleteOpen(true)}
      className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10"
    >
      <Trash2 className="h-4 w-4" />
      Xóa đã chọn ({selectedIds.length})
    </Button>
  ) : null;

  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <div className="space-y-4">
      {/* Breadcrumb + status pill */}
      <div className="flex items-center gap-3">
        <nav className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">Trang chủ</span>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-primary font-semibold">Liên hệ</span>
        </nav>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-1.5 bg-primary/10 px-2 py-0.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-bold text-primary tracking-wider font-mono">SALE ACTIVE</span>
        </div>
      </div>

      {/* Search + action bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 rounded-xl bg-muted/40 border-border"
            placeholder="Tìm kiếm liên hệ, công ty hoặc SĐT…"
            value={appliedSearch}
            onChange={(e) => { setAppliedSearch(e.target.value); pagination.setPage(1); }}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" className="gap-2 rounded-xl border-dashed" onClick={() => setFilterOpen((v) => !v)}>
            <SlidersHorizontal className="h-4 w-4" />
            Lọc
          </Button>
          {importAction ?? (
            <Button variant="secondary" className="gap-2 rounded-xl">
              <Upload className="h-4 w-4" />
              Nhập dữ liệu
            </Button>
          )}
          <div className="flex items-center gap-1">
            {bulkDeleteButton}{allocateButton}{refreshButton}
            <ContactMergeButton />
            <ExportButton entity="contacts" filters={{ search: pagination.search }} />
            <Button onClick={() => setFormOpen(true)} className="rounded-xl">
              <span className="mr-1">+</span>Tạo liên hệ
            </Button>
          </div>
        </div>
      </div>

      {/* Collapsible advanced filters */}
      {filterOpen && (
        <div className="flex items-end gap-2 flex-wrap p-3 rounded-xl border border-dashed border-border bg-muted/20">
          <div className="space-y-1">
            <Label className="text-xs">{VI.contact.source}</Label>
            <Input placeholder="VD: website, zalo" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="w-32" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{VI.contact.tags}</Label>
            <Input placeholder="VD: VIP" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className="w-28" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Từ ngày</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Đến ngày</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" />
          </div>
          {(dateFrom || dateTo || sourceFilter || tagFilter) && (
            <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); setSourceFilter(''); setTagFilter(''); }}>Xóa lọc</Button>
          )}
        </div>
      )}

      <DottedCard>
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        total={data?.meta.total ?? 0}
        page={pagination.page}
        limit={pagination.limit}
        isLoading={isLoading}
        onSearchSubmit={(v) => { setAppliedSearch(v); pagination.setPage(1); }}
        onPageChange={pagination.setPage}
        onLimitChange={pagination.setLimit}
        onSort={pagination.handleSort}
        sortKey={pagination.sortKey}
        sortOrder={pagination.sortOrder}
        onRowClick={(row) => setSelectedContactId(row.id)}
        actions={(row) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSelectedContactId(row.id)}>
                <Edit2 className="mr-2 h-4 w-4" /> Sửa
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setDeleteTarget(row)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {VI.actions.delete}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      </DottedCard>

      <ContactForm open={formOpen} onClose={() => setFormOpen(false)} />

      <ContactDetailDialog
        contactId={selectedContactId}
        onClose={() => setSelectedContactId(null)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        loading={deleteMutation.isPending}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={() => bulkDeleteMutation.mutate(selectedIds)}
        loading={bulkDeleteMutation.isPending}
        title="Xóa liên hệ hàng loạt"
        description={`Bạn sắp xóa ${selectedIds.length} liên hệ đã chọn. Hành động này không thể hoàn tác.`}
      />

      <DataAllocationDialog
        open={allocateOpen}
        onClose={() => setAllocateOpen(false)}
        entityType="contact"
        selectedIds={selectedIds}
        alreadyAssignedCount={
          currentPageRows.filter((r) => selectedIds.includes(r.id) && r.assignedTo).length
        }
        onSuccess={() => {
          setSelectedIds([]);
          queryClient.invalidateQueries({ queryKey: ['contacts'] });
        }}
      />
    </div>
  );
}
