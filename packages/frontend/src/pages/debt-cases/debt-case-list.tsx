import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Filter, RefreshCw, Users, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { usePagination } from '@/hooks/use-pagination';
import api from '@/services/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { useAgentStatusStore } from '@/stores/agent-status-store';
import { VI } from '@/lib/vi-text';
import { ExportButton } from '@/components/export-button';
import { formatMoney, fmtPhone, checkCallBlocked } from '@/lib/format';
import { DEBT_TIERS, DEBT_STATUSES, type DebtTier, type DebtStatus } from '@shared/constants/enums';
import { DataAllocationDialog } from '@/components/data-allocation-dialog';
import { Phone } from 'lucide-react';

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

// DPD pill: red >30, amber 1-30, grey 0
function DpdPill({ dpd }: { dpd: number }) {
  if (dpd <= 0) {
    return (
      <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded font-mono text-xs">—</span>
    );
  }
  if (dpd > 30) {
    return (
      <span className="px-2 py-0.5 bg-destructive text-destructive-foreground rounded font-mono text-xs font-bold">
        {dpd} ngày
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded font-mono text-xs font-bold">
      {dpd} ngày
    </span>
  );
}

// Status pill matching mockup
function StatusPill({ status }: { status: DebtStatus }) {
  const configs: Record<DebtStatus, { dot: string; bg: string; text: string; label: string }> = {
    active:          { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Chưa đến hạn' },
    in_progress:     { dot: 'bg-amber-500',   bg: 'bg-amber-50',   text: 'text-amber-700',   label: 'Đang gọi nhắc nợ' },
    promise_to_pay:  { dot: 'bg-violet-500',  bg: 'bg-violet-50',  text: 'text-violet-700',  label: VI.debt.statuses.promise_to_pay },
    paid:            { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', label: VI.debt.statuses.paid },
    written_off:     { dot: 'bg-destructive animate-pulse', bg: 'bg-destructive/10', text: 'text-destructive', label: 'Chuyển pháp lý' },
  };
  const c = configs[status] ?? configs.active;
  return (
    <div className={`flex items-center gap-1.5 text-xs font-medium ${c.bg} ${c.text} px-2 py-1 rounded-full w-fit`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </div>
  );
}

// Segment chip tabs
type Segment = 'all' | 'pending' | 'overdue' | 'done';
const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'all',     label: 'Tất cả' },
  { key: 'pending', label: 'Đang chờ xử lý' },
  { key: 'overdue', label: 'Đã quá hạn' },
  { key: 'done',    label: 'Đã hoàn tất' },
];

export default function DebtCaseListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, hasPermission } = useAuthStore();
  const myStatus = useAgentStatusStore((s) => s.myStatus);
  const [segment, setSegment] = useState<Segment>('all');
  const [showAdvFilter, setShowAdvFilter] = useState(false);
  const [tierFilter, setTierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [allocateOpen, setAllocateOpen] = useState(false);
  const { page, setPage, limit, setLimit, sortKey, sortOrder, handleSort, queryParams } = usePagination();

  const canAllocate = hasPermission('crm.data_allocation');

  function toggleSelect(id: string) {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function toggleSelectAll(rows: DebtCase[]) {
    const allIds = rows.map((r) => r.id);
    const allSelected = allIds.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected ? selectedIds.filter((id) => !allIds.includes(id)) : [...new Set([...selectedIds, ...allIds])]);
  }

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

  const currentPageRows = data?.items ?? [];
  const allPageSelected = currentPageRows.length > 0 && currentPageRows.every((r) => selectedIds.includes(r.id));
  const total = data?.total ?? 0;

  // KPI tính từ items đang load (phạm vi trang hiện tại — backend summary endpoint chưa có).
  // Khi không có data → hiển thị "—" thay vì mock cứng.
  const items = currentPageRows;
  const totalDebt = items.reduce((s, r) => s + (r.totalAmount ?? 0), 0);
  const overdueDebt = items.reduce((s, r) => s + (r.dpd > 0 ? (r.totalAmount - (r.paidAmount ?? 0)) : 0), 0);
  const collected = items.reduce((s, r) => s + (r.paidAmount ?? 0), 0);
  const recoveryRate = totalDebt > 0 ? (collected / totalDebt) * 100 : 0;
  const paidCount = items.filter((r) => r.status === 'paid').length;
  const hasData = items.length > 0;

  const fmtVnd = (n: number) => n.toLocaleString('vi-VN');

  const kpiCards = [
    {
      label: 'TỔNG NỢ',
      value: hasData ? fmtVnd(totalDebt) : '—',
      unit: hasData ? 'VND' : '',
      color: 'text-foreground',
      footer: hasData
        ? <span className="text-[10px] text-muted-foreground">{items.length} hợp đồng</span>
        : <span className="text-[10px] text-muted-foreground">Chưa có dữ liệu</span>,
    },
    {
      label: 'QUÁ HẠN',
      value: hasData ? fmtVnd(overdueDebt) : '—',
      unit: hasData ? 'VND' : '',
      color: 'text-destructive',
      footer: hasData && overdueDebt > 0
        ? <span className="text-[10px] text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">High Risk</span>
        : <span className="text-[10px] text-muted-foreground">Không có khoản quá hạn</span>,
    },
    {
      label: 'ĐÃ THU',
      value: hasData ? fmtVnd(collected) : '—',
      unit: hasData ? 'VND' : '',
      color: 'text-primary',
      footer: <span className="text-[10px] text-muted-foreground">{paidCount} phiếu hoàn tất</span>,
    },
    {
      label: 'TỶ LỆ THU HỒI',
      value: hasData ? recoveryRate.toFixed(1) : '—',
      unit: hasData ? '%' : '',
      color: 'text-foreground',
      footer: hasData ? (
        <div className="mt-1 h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, recoveryRate)}%` }} />
        </div>
      ) : <span className="text-[10px] text-muted-foreground">—</span>,
    },
  ];

  return (
    <div className="space-y-4">
      {/* KPI Strip */}
      <div className="grid grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <div key={kpi.label} className="bg-card rounded-xl shadow-sm border border-border flex flex-col p-4">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-2">{kpi.label}</span>
            <span className={`font-mono text-2xl font-semibold ${kpi.color}`}>
              {kpi.value} <small className="text-xs font-normal opacity-50">{kpi.unit}</small>
            </span>
            <div className="mt-3 pt-3 border-t border-dashed border-border">
              {kpi.footer}
            </div>
          </div>
        ))}
      </div>

      {/* Segment + Actions row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* Segment chips */}
        <div className="flex gap-2 flex-wrap">
          {SEGMENTS.map((seg) => (
            <button
              key={seg.key}
              onClick={() => setSegment(seg.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                segment === seg.key
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'bg-card border border-border text-muted-foreground hover:border-primary hover:text-primary'
              }`}
            >
              {seg.label}
            </button>
          ))}
        </div>
        {/* Right actions */}
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
            <Button variant="outline" size="sm" onClick={() => setAllocateOpen(true)} className="gap-1.5">
              <Users className="h-4 w-4" />
              Phân bổ ({selectedIds.length})
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['debt-cases'] })}
            title={VI.actions.refresh}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <ExportButton entity="debt-cases" filters={{ search: appliedSearch || '', tier: tierFilter, status: statusFilter }} />
        </div>
      </div>

      {/* Advanced filters (collapsible) */}
      {showAdvFilter && (
        <div className="bg-card border border-dashed border-border rounded-xl p-4 flex items-end gap-3 flex-wrap">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">Nhóm nợ</label>
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="flex h-9 w-40 rounded-md border border-border bg-background px-3 py-1 text-sm"
            >
              <option value="">Tất cả nhóm nợ</option>
              {DEBT_TIERS.map((t) => (
                <option key={t} value={t}>{VI.debt.tiers[t]}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">Trạng thái</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex h-9 w-44 rounded-md border border-border bg-background px-3 py-1 text-sm"
            >
              <option value="">Tất cả trạng thái</option>
              {DEBT_STATUSES.map((s) => (
                <option key={s} value={s}>{VI.debt.statuses[s]}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">Từ ngày</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="flex h-9 w-36 rounded-md border border-border bg-background px-3 py-1 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground font-medium">Đến ngày</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="flex h-9 w-36 rounded-md border border-border bg-background px-3 py-1 text-sm" />
          </div>
          {(dateFrom || dateTo || tierFilter || statusFilter) && (
            <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); setTierFilter(''); setStatusFilter(''); }}>
              Xóa lọc
            </Button>
          )}
        </div>
      )}

      {/* Debt Table Card */}
      <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
        {/* Search bar */}
        <div className="px-4 py-3 border-b border-dashed border-border flex items-center gap-3">
          <input
            type="search"
            placeholder="Tìm khách hàng, hợp đồng..."
            defaultValue={appliedSearch}
            onKeyDown={(e) => { if (e.key === 'Enter') { setAppliedSearch((e.target as HTMLInputElement).value); setPage(1); } }}
            className="flex-1 h-9 rounded-md border border-border bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/50 border-b border-dashed border-border">
              {canAllocate && (
                <th className="px-4 py-3 w-10">
                  <Checkbox
                    checked={allPageSelected}
                    onCheckedChange={() => toggleSelectAll(currentPageRows)}
                    aria-label="Chọn tất cả"
                  />
                </th>
              )}
              <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Khách hàng</th>
              <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Số tiền nợ</th>
              <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Ngày đáo hạn</th>
              <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold text-center">Số ngày trễ</th>
              <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Trạng thái xử lý</th>
              <th className="px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Người xử lý</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dashed divide-border">
            {isLoading ? (
              <tr><td colSpan={canAllocate ? 7 : 6} className="px-4 py-8 text-center text-muted-foreground text-sm">Đang tải...</td></tr>
            ) : currentPageRows.length === 0 ? (
              <tr><td colSpan={canAllocate ? 7 : 6} className="px-4 py-8 text-center text-muted-foreground text-sm">{VI.actions.noData}</td></tr>
            ) : (
              currentPageRows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-accent/20 cursor-pointer transition-colors"
                  onClick={() => navigate(`/debt-cases/${row.id}`)}
                >
                  {canAllocate && (
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.includes(row.id)}
                        onCheckedChange={() => toggleSelect(row.id)}
                        aria-label="Chọn"
                      />
                    </td>
                  )}
                  {/* Customer cell */}
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground">{row.contact?.fullName ?? '—'}</span>
                      {row.contact && (
                        <span className="text-xs text-muted-foreground font-mono">CID: {row.contact.id.slice(-6)}</span>
                      )}
                    </div>
                  </td>
                  {/* Amount */}
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm text-foreground">{formatMoney(row.totalAmount)}</span>
                    {row.contact?.phone && (
                      <div className="mt-0.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const blocked = checkCallBlocked(myStatus, user?.sipExtension);
                            if (blocked) { toast.error(blocked); return; }
                            api.post('/calls/originate', { phone: row.contact!.phone })
                              .then(() => toast.success(`Đang gọi ${fmtPhone(row.contact!.phone)}...`))
                              .catch((err: { response?: { data?: { error?: { message?: string } } }; message?: string }) =>
                                toast.error(err?.response?.data?.error?.message || 'Không thể gọi'));
                          }}
                          className="inline-flex items-center gap-1 text-[10px] text-emerald-700 hover:text-emerald-900"
                          title="Gọi"
                        >
                          <Phone className="h-3 w-3" />
                          {fmtPhone(row.contact.phone)}
                        </button>
                      </div>
                    )}
                  </td>
                  {/* Due date */}
                  <td className="px-4 py-3 font-mono text-sm text-muted-foreground">
                    {row.createdAt ? format(new Date(row.createdAt), 'dd/MM/yyyy') : '—'}
                  </td>
                  {/* DPD */}
                  <td className="px-4 py-3 text-center">
                    <DpdPill dpd={row.dpd} />
                  </td>
                  {/* Status */}
                  <td className="px-4 py-3">
                    <StatusPill status={row.status} />
                  </td>
                  {/* Assignee placeholder */}
                  <td className="px-4 py-3">
                    <span className="text-sm text-muted-foreground">—</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Footer pagination */}
        <div className="px-4 py-3 border-t border-dashed border-border bg-muted/20 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Hiển thị {currentPageRows.length > 0 ? `${(page - 1) * limit + 1}-${Math.min(page * limit, total)}` : '0'} trên {total} kết quả
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="w-8 h-8 flex items-center justify-center rounded border border-border bg-card text-muted-foreground hover:text-foreground disabled:opacity-40 text-xs"
            >
              ‹
            </button>
            {Array.from({ length: Math.min(5, Math.ceil(total / limit)) }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-8 h-8 flex items-center justify-center rounded border text-xs font-medium transition-colors ${
                  p === page
                    ? 'border-primary bg-accent text-primary font-bold'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= Math.ceil(total / limit)}
              className="w-8 h-8 flex items-center justify-center rounded border border-border bg-card text-muted-foreground hover:text-foreground disabled:opacity-40 text-xs"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      <DataAllocationDialog
        open={allocateOpen}
        onClose={() => setAllocateOpen(false)}
        entityType="debt_case"
        selectedIds={selectedIds}
        onSuccess={() => {
          setSelectedIds([]);
          queryClient.invalidateQueries({ queryKey: ['debt-cases'] });
        }}
      />
    </div>
  );
}
