/* call-log-list v11 — ops restyle */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Mic, RefreshCw, Download, CheckSquare, Trash2, Save, Search } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { deleteCallRecording } from '@/api/call-log-api';
import { SectionHeader } from '@/components/ops/section-header';
import { DataTable, type Column } from '@/components/data-table/data-table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { usePagination } from '@/hooks/use-pagination';
import api, { getAccessToken } from '@/services/api-client';
import { VI } from '@/lib/vi-text';
import { ExportButton } from '@/components/export-button';
import { formatDuration, fmtPhone } from '@/lib/format';
import { CallLogDetailContent } from './call-log-detail';

const HANGUP_CAUSE_VI: Record<string, string> = {
  NORMAL_CLEARING: 'Thành công',
  ORIGINATOR_CANCEL: 'Hủy',
  NO_ANSWER: 'Không trả lời',
  USER_BUSY: 'Máy bận',
  CALL_REJECTED: 'Từ chối cuộc gọi',
  UNALLOCATED_NUMBER: 'Số không tồn tại',
  NO_ROUTE_DESTINATION: 'Không tìm thấy đích',
  RECOVERY_ON_TIMER_EXPIRE: 'Hết thời gian',
  LOSE_RACE: 'Cuộc gọi bị chiếm',
  SUBSCRIBER_ABSENT: 'Thuê bao không liên lạc được',
  NORMAL_TEMPORARY_FAILURE: 'Lỗi tạm thời',
  DESTINATION_OUT_OF_ORDER: 'Đích không hoạt động',
  INVALID_NUMBER_FORMAT: 'Sai định dạng số',
  FACILITY_REJECTED: 'Dịch vụ bị từ chối',
  EXCHANGE_ROUTING_ERROR: 'Lỗi định tuyến',
  NORMAL_UNSPECIFIED: 'Bình thường',
};


interface CallLog {
  id: string;
  callerNumber: string;
  destinationNumber?: string;
  direction: 'inbound' | 'outbound';
  duration: number;
  billsec?: number;
  disposition?: string;
  hangupCause?: string;
  sipCode?: string;
  sipReason?: string;
  startTime: string;
  endTime?: string;
  recordingStatus?: string;
  notes?: string;
  user?: { fullName: string };
  dispositionCode?: { id: string; label: string };
  dispositionSetBy?: { id: string; fullName: string } | null;
  dispositionSetAt?: string | null;
}

interface DispositionOption {
  id: string;
  code: string;
  label: string;
}

/** Get agent extension number based on call direction */
function getAgentNumber(row: CallLog): string {
  return row.direction === 'inbound' ? (row.destinationNumber || '') : row.callerNumber;
}

/** Get customer phone number based on call direction */
function getCustomerNumber(row: CallLog): string {
  return row.direction === 'inbound' ? row.callerNumber : (row.destinationNumber || '');
}

interface AgentOption {
  id: string;
  fullName: string;
  sipExtension?: string | null;
}

export default function CallLogListPage() {
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canDeleteRecording = hasPermission('recording.delete');
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  // Applied filters — what the query actually uses. Only mutated by the "Tìm kiếm" button.
  const [directionFilter, setDirectionFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [agentFilter, setAgentFilter] = useState('');
  // Draft filters — what the user is typing/picking. Stays local until submit.
  const [draftDirection, setDraftDirection] = useState('');
  const [draftDateFrom, setDraftDateFrom] = useState('');
  const [draftDateTo, setDraftDateTo] = useState('');
  const [destSearchDraft, setDestSearchDraft] = useState('');
  const [draftAgent, setDraftAgent] = useState('');
  // Pending disposition edits — buffer locally until user clicks the save icon.
  const [pendingDispositions, setPendingDispositions] = useState<Record<string, string>>({});

  // Agent dropdown source — cluster-scoped on backend
  const { data: agents = [] } = useQuery<AgentOption[]>({
    queryKey: ['call-log-agents'],
    queryFn: () => api.get('/users', { params: { limit: 200 } }).then((r) => r.data.data as AgentOption[]),
    staleTime: 5 * 60_000,
  });

  // Disposition options for inline status editor
  const { data: dispositionOptions = [] } = useQuery<DispositionOption[]>({
    queryKey: ['disposition-codes-active'],
    queryFn: () => api.get('/disposition-codes', { params: { active: 'true' } }).then((r) => r.data.data),
    staleTime: 5 * 60_000,
  });

  async function saveDisposition(callLogId: string, dispositionCodeId: string) {
    try {
      await api.post(`/call-logs/${callLogId}/disposition`, { dispositionCodeId });
      toast.success('Đã cập nhật trạng thái');
      setPendingDispositions((prev) => {
        const next = { ...prev };
        delete next[callLogId];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['call-logs'] });
    } catch (err) {
      toast.error(`Lỗi cập nhật trạng thái: ${(err as Error).message}`);
    }
  }
  async function handleDeleteRecording(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm('Xác nhận xoá ghi âm cuộc gọi này?')) return;
    try {
      await deleteCallRecording(id);
      toast.success('Đã xoá ghi âm');
      queryClient.invalidateQueries({ queryKey: ['call-logs'] });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 403) {
        toast.error('Bạn không có quyền xoá ghi âm');
      } else {
        toast.error(`Lỗi xoá ghi âm: ${(err as Error).message}`);
      }
    }
  }

  const [resultFilter, setResultFilter] = useState('');
  const [sipCodeFilter, setSipCodeFilter] = useState('');
  const [callTypeFilter, setCallTypeFilter] = useState('');
  const [dispositionFilter, setDispositionFilter] = useState('');
  const [draftResult, setDraftResult] = useState('');
  const [draftSipCode, setDraftSipCode] = useState('');
  const [draftCallType, setDraftCallType] = useState('');
  const [draftDisposition, setDraftDisposition] = useState('');
  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const { page, setPage, limit, setLimit, sortKey, sortOrder, handleSort, queryParams } = usePagination();

  const { data, isLoading } = useQuery({
    queryKey: ['call-logs', queryParams, directionFilter, dateFrom, dateTo, appliedSearch, agentFilter, resultFilter, sipCodeFilter, callTypeFilter, dispositionFilter],
    queryFn: async () => {
      const params: Record<string, string | number> = { ...queryParams, search: appliedSearch };
      if (directionFilter) params.direction = directionFilter;
      if (dateFrom) params.dateFrom = `${dateFrom}T00:00:00`;
      if (dateTo) params.dateTo = `${dateTo}T23:59:59`;
      if (agentFilter) params.userId = agentFilter;
      if (resultFilter) params.hangupCause = resultFilter;
      if (sipCodeFilter) params.sipCode = sipCodeFilter;
      if (callTypeFilter) params.callType = callTypeFilter;
      if (dispositionFilter) params.disposition = dispositionFilter;
      const { data: resp } = await api.get('/call-logs', { params });
      return { items: resp.data as CallLog[], total: resp.meta?.total ?? 0 };
    },
  });

  async function handleBulkDownload() {
    if (selectedIds.size === 0) return;
    setBulkDownloading(true);
    try {
      const token = getAccessToken();
      const res = await fetch('/api/v1/call-logs/bulk-download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `recordings_${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success(`Đã tải ${selectedIds.size} bản ghi âm`);
      setSelectedIds(new Set());
    } catch (err) {
      toast.error(`Lỗi tải xuống: ${(err as Error).message}`);
    } finally {
      setBulkDownloading(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const currentIds = data?.items.map((r) => r.id) ?? [];
    if (currentIds.every((id) => selectedIds.has(id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(currentIds));
    }
  }

  const allSelected = (data?.items.length ?? 0) > 0 && (data?.items ?? []).every((r) => selectedIds.has(r.id));

  const columns: Column<CallLog>[] = [
    {
      key: 'id',
      label: <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} />,
      render: (row) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={selectedIds.has(row.id)} onCheckedChange={() => toggleSelect(row.id)} />
        </div>
      ),
    },
    {
      key: 'direction', label: VI.callLog.direction,
      render: (row) => (
        <Badge variant={row.direction === 'inbound' ? 'default' : 'secondary'}>
          {row.direction === 'inbound' ? VI.callLog.inbound : VI.callLog.outbound}
        </Badge>
      ),
    },
    { key: 'callerNumber', label: 'Số gọi', render: (row) => fmtPhone(getAgentNumber(row)) || '—' },
    { key: 'destinationNumber', label: 'Số nhận', render: (row) => fmtPhone(getCustomerNumber(row)) || '—' },
    { key: 'user', label: VI.callLog.agent, render: (row) => row.user?.fullName ?? '—' },
    { key: 'duration', label: VI.callLog.duration, sortable: true, render: (row) => formatDuration(row.duration) },
    { key: 'billsec', label: 'Thời gian nói', render: (row) => row.billsec != null ? formatDuration(row.billsec) : '—' },
    {
      key: 'recordingStatus', label: VI.callLog.recording,
      render: (row) => row.recordingStatus === 'available'
        ? (
          <div className="flex items-center gap-1">
            <Mic className="h-4 w-4 text-green-500 shrink-0" />
            {canDeleteRecording && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive"
                title="Xoá ghi âm"
                onClick={(e) => handleDeleteRecording(row.id, e)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )
        : <span className="text-muted-foreground text-xs">—</span>,
    },
    {
      key: 'hangupCause', label: 'Kết quả',
      render: (row) => {
        // SIP code is source of truth when it exists (different CDR legs can have conflicting hangupCause)
        const code = row.sipCode ? parseInt(row.sipCode, 10) : 0;
        if (code === 200) return 'Thành công';
        if (code === 430) return 'Voicemail';
        if (code === 486) return 'Máy bận';
        if (code === 487) return 'Hủy';
        if (code === 480) return 'Không trả lời';
        if (code === 404) return 'Số không tồn tại';
        if (code === 403) return 'Từ chối cuộc gọi';
        if (code === 408) return 'Hết thời gian';
        if (code === 500) return 'Lỗi server';
        if (code === 503) return 'Dịch vụ không khả dụng';
        // No SIP code → use hangupCause
        return row.hangupCause ? (HANGUP_CAUSE_VI[row.hangupCause] ?? row.hangupCause) : '—';
      },
    },
    { key: 'sipCode', label: 'SIP Code', render: (row) => row.sipCode || '—' },
    {
      key: 'sipReason', label: 'Lý do SIP',
      // SIP sub-reason — English short labels (protocol-standard, grep-friendly against FS logs).
      render: (row) => {
        const code = row.sipCode ? parseInt(row.sipCode, 10) : 0;
        if (code === 200) return 'Answered';
        if (code === 430) return 'Voicemail';
        if (code === 480) return 'No answer';
        if (code === 486) return 'Busy';
        if (code === 487) return 'Cancelled';
        if (code === 404) return 'Not found';
        if (code === 403) return 'Rejected';
        if (code === 408) return 'Timeout';
        if (code === 500) return 'Server error';
        if (code === 503) return 'Unavailable';
        if (row.hangupCause === 'NORMAL_CLEARING') return 'Answered';
        if (row.hangupCause === 'USER_BUSY') return 'Busy';
        if (row.hangupCause === 'NO_ANSWER') return 'No answer';
        if (row.hangupCause === 'ORIGINATOR_CANCEL') return 'Cancelled';
        if (row.hangupCause === 'CALL_REJECTED') return 'Rejected';
        return row.sipReason || row.hangupCause || '—';
      },
    },
    {
      key: 'callType', label: 'Phân loại',
      // Call origin only — not the disposition. Kept English (product-level label).
      render: (row) => {
        const source = (row.notes || '').trim();
        if (source === 'c2c') return 'Click2call';
        if (source === 'autocall') return 'Autocall';
        if (source === 'callbot') return 'Callbot';
        return 'Manual';
      },
    },
    {
      key: 'status', label: 'Trạng thái',
      // Agent edits locally; persisted only when the Save icon is clicked.
      render: (row) => {
        const by = row.dispositionSetBy?.fullName;
        const at = row.dispositionSetAt ? format(new Date(row.dispositionSetAt), 'dd/MM/yyyy HH:mm') : '';
        const title = by ? `Cập nhật bởi ${by}${at ? ` lúc ${at}` : ''}` : 'Chưa cập nhật';
        const originalId = row.dispositionCode?.id ?? '';
        const draftId = pendingDispositions[row.id];
        const selectedId = draftId ?? originalId;
        const isDirty = draftId !== undefined && draftId !== originalId;
        const label = dispositionOptions.find((o) => o.id === selectedId)?.label ?? row.dispositionCode?.label;
        return (
          <div onClick={(e) => e.stopPropagation()} title={title} className="flex items-center gap-1">
            <Select
              value={selectedId || undefined}
              onValueChange={(v) => { if (v) setPendingDispositions((prev) => ({ ...prev, [row.id]: v })); }}
            >
              <SelectTrigger className="h-8 w-40 text-xs">
                {label
                  ? <span className={isDirty ? 'text-amber-600 font-medium' : ''}>{label}</span>
                  : <span className="text-muted-foreground">—</span>}
              </SelectTrigger>
              <SelectContent>
                {dispositionOptions.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isDirty && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-emerald-600 hover:text-emerald-700"
                title="Lưu"
                onClick={() => saveDisposition(row.id, draftId!)}
              >
                <Save className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        );
      },
    },
    {
      key: 'startTime', label: VI.callLog.startTime, sortable: true,
      render: (row) => format(new Date(row.startTime), 'dd/MM/yyyy HH:mm'),
    },
    {
      key: 'endTime', label: 'Kết thúc',
      render: (row) => row.endTime ? format(new Date(row.endTime), 'dd/MM/yyyy HH:mm') : '—',
    },
  ];

  function handleClearFilters() {
    setDirectionFilter(''); setDraftDirection('');
    setDateFrom(''); setDraftDateFrom('');
    setDateTo(''); setDraftDateTo('');
    setAgentFilter(''); setDraftAgent('');
    setResultFilter(''); setDraftResult('');
    setSipCodeFilter(''); setDraftSipCode('');
    setCallTypeFilter(''); setDraftCallType('');
    setDispositionFilter(''); setDraftDisposition('');
    setDestSearchDraft('');
    setAppliedSearch('');
    setPage(1);
  }

  function applyFilters() {
    setDirectionFilter(draftDirection);
    setDateFrom(draftDateFrom);
    setDateTo(draftDateTo);
    setAgentFilter(draftAgent);
    setResultFilter(draftResult);
    setSipCodeFilter(draftSipCode.trim());
    setCallTypeFilter(draftCallType);
    setDispositionFilter(draftDisposition);
    setAppliedSearch(destSearchDraft.trim());
    setPage(1);
  }

  const hasFilters = directionFilter || dateFrom || dateTo || agentFilter || resultFilter || sipCodeFilter || callTypeFilter || dispositionFilter || appliedSearch;
  const hasDraftChanges =
    draftDirection !== directionFilter ||
    draftDateFrom !== dateFrom ||
    draftDateTo !== dateTo ||
    draftAgent !== agentFilter ||
    draftResult !== resultFilter ||
    draftSipCode.trim() !== sipCodeFilter ||
    draftCallType !== callTypeFilter ||
    draftDisposition !== dispositionFilter ||
    destSearchDraft.trim() !== appliedSearch;

  const CALL_TYPE_LABEL: Record<string, string> = { c2c: 'Click2call', autocall: 'Autocall', manual: 'Manual', callbot: 'Callbot' };

  const toolbar = (
    <div
      className="flex items-end gap-2 flex-wrap"
      onKeyDown={(e) => { if (e.key === 'Enter') applyFilters(); }}
    >
      <div className="space-y-1">
        <Label className="text-xs">Số nhận</Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="VD: 0983..."
            value={destSearchDraft}
            onChange={(e) => setDestSearchDraft(e.target.value)}
            className="w-40 pl-8 h-9"
          />
        </div>
      </div>
      <Select value={draftDirection || undefined} onValueChange={(v) => setDraftDirection(v === '_all' ? '' : v || '')}>
        <SelectTrigger className="w-36">
          {draftDirection
            ? <span>{draftDirection === 'inbound' ? VI.callLog.inbound : VI.callLog.outbound}</span>
            : <span className="text-muted-foreground">Tất cả hướng</span>}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Tất cả hướng</SelectItem>
          <SelectItem value="inbound">{VI.callLog.inbound}</SelectItem>
          <SelectItem value="outbound">{VI.callLog.outbound}</SelectItem>
        </SelectContent>
      </Select>
      <Select value={draftResult || undefined} onValueChange={(v) => setDraftResult(v === '_all' ? '' : v || '')}>
        <SelectTrigger className="w-44">
          {draftResult
            ? <span>{HANGUP_CAUSE_VI[draftResult] ?? draftResult}</span>
            : <span className="text-muted-foreground">Tất cả kết quả</span>}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Tất cả kết quả</SelectItem>
          <SelectItem value="NORMAL_CLEARING">Thành công</SelectItem>
          <SelectItem value="NO_ANSWER">Không trả lời</SelectItem>
          <SelectItem value="USER_BUSY">Máy bận</SelectItem>
          <SelectItem value="ORIGINATOR_CANCEL">Hủy</SelectItem>
          <SelectItem value="CALL_REJECTED">Từ chối</SelectItem>
        </SelectContent>
      </Select>
      <Select value={draftCallType || undefined} onValueChange={(v) => setDraftCallType(v === '_all' ? '' : v || '')}>
        <SelectTrigger className="w-40">
          {draftCallType
            ? <span>{CALL_TYPE_LABEL[draftCallType] ?? draftCallType}</span>
            : <span className="text-muted-foreground">Tất cả phân loại</span>}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Tất cả phân loại</SelectItem>
          <SelectItem value="manual">Manual</SelectItem>
          <SelectItem value="c2c">Click2call</SelectItem>
          <SelectItem value="autocall">Autocall</SelectItem>
          <SelectItem value="callbot">Callbot</SelectItem>
        </SelectContent>
      </Select>
      <Select value={draftDisposition || undefined} onValueChange={(v) => setDraftDisposition(v === '_all' ? '' : v || '')}>
        <SelectTrigger className="w-44">
          {draftDisposition
            ? <span>{dispositionOptions.find((o) => o.id === draftDisposition)?.label ?? '—'}</span>
            : <span className="text-muted-foreground">Tất cả trạng thái</span>}
        </SelectTrigger>
        <SelectContent className="max-h-80">
          <SelectItem value="_all">Tất cả trạng thái</SelectItem>
          {dispositionOptions.map((opt) => (
            <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={draftAgent || undefined} onValueChange={(v) => setDraftAgent(v === '_all' ? '' : v || '')}>
        <SelectTrigger className="w-36">
          {draftAgent
            ? <span>{agents.find((a) => a.id === draftAgent)?.sipExtension ?? '—'}</span>
            : <span className="text-muted-foreground">Tất cả nhân viên</span>}
        </SelectTrigger>
        <SelectContent className="max-h-80">
          <SelectItem value="_all">Tất cả nhân viên</SelectItem>
          {agents
            .filter((a) => a.sipExtension) // drop accounts without an extension (admins, system users)
            .sort((a, b) => (a.sipExtension ?? '').localeCompare(b.sipExtension ?? '', undefined, { numeric: true }))
            .map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.sipExtension}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
      <div className="space-y-1">
        <Label className="text-xs">SIP Code</Label>
        <Input placeholder="VD: 200, 486" value={draftSipCode} onChange={(e) => setDraftSipCode(e.target.value)} className="w-28" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Từ ngày</Label>
        <Input type="date" value={draftDateFrom} onChange={(e) => setDraftDateFrom(e.target.value)} className="w-36" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Đến ngày</Label>
        <Input type="date" value={draftDateTo} onChange={(e) => setDraftDateTo(e.target.value)} className="w-36" />
      </div>
      <Button size="sm" onClick={applyFilters} disabled={!hasDraftChanges}>
        <Search className="h-4 w-4 mr-1" />Tìm kiếm
      </Button>
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={handleClearFilters}>Xóa lọc</Button>
      )}
    </div>
  );

  const refreshButton = (
    <Button
      variant="outline"
      size="icon"
      onClick={() => queryClient.invalidateQueries({ queryKey: ['call-logs'] })}
      title={VI.actions.refresh}
    >
      <RefreshCw className="h-4 w-4" />
    </Button>
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        label={VI.callLog.title}
        actions={
          <>
            {selectedIds.size > 0 && (
              <Button variant="outline" size="sm" onClick={handleBulkDownload} disabled={bulkDownloading}>
                {bulkDownloading ? (
                  <><CheckSquare className="h-4 w-4 mr-1" />Đang tải...</>
                ) : (
                  <><Download className="h-4 w-4 mr-1" />Tải {selectedIds.size} ghi âm</>
                )}
              </Button>
            )}
            {refreshButton}
            <ExportButton entity="call-logs" filters={{ search: appliedSearch, direction: directionFilter, hangupCause: resultFilter, sipCode: sipCodeFilter, dateFrom, dateTo }} />
          </>
        }
      />
      <DataTable<CallLog>
        columns={columns}
        data={data?.items ?? []}
        total={data?.total ?? 0}
        page={page}
        limit={limit}
        isLoading={isLoading}
        onPageChange={setPage}
        onLimitChange={setLimit}
        onSort={handleSort}
        sortKey={sortKey}
        sortOrder={sortOrder}
        onRowClick={(row) => setSelectedCallId(row.id)}
        toolbar={toolbar}
      />

      <Dialog open={!!selectedCallId} onOpenChange={(open) => { if (!open) setSelectedCallId(null); }}>
        <DialogContent className="sm:max-w-[1000px] max-h-[85vh] overflow-y-auto">
          {selectedCallId && (
            <CallLogDetailContent id={selectedCallId} onClose={() => setSelectedCallId(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
