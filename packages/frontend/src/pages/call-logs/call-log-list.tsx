/* call-log-list v12 — mockup-06 alignment */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Mic, RefreshCw, Download, CheckSquare, Trash2, Save, Search, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { deleteCallRecording } from '@/api/call-log-api';
import { SectionHeader } from '@/components/ops/section-header';
import { DataTable, type Column } from '@/components/data-table/data-table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { usePagination } from '@/hooks/use-pagination';
import api, { getAccessToken } from '@/services/api-client';
import { VI } from '@/lib/vi-text';
import { ExportButton } from '@/components/export-button';
import { formatDuration, fmtPhone } from '@/lib/format';
import { CallLogDetailContent } from './call-log-detail';
import { AudioPlayer } from '@/components/audio-player';

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

/** SIP status pill — "200 OK" / "486 Busy" style with border + mono, matching mockup 06 */
function SipStatusPill({ sipCode, hangupCause }: { sipCode?: string; hangupCause?: string }) {
  const code = sipCode ? parseInt(sipCode, 10) : 0;
  type PillDef = { label: string; cls: string };
  const map: Record<number, PillDef> = {
    200: { label: '200 OK',         cls: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800' },
    430: { label: '430 Voicemail',  cls: 'bg-slate-50  text-slate-500   border-slate-200   dark:bg-slate-800/40  dark:text-slate-400   dark:border-slate-700' },
    480: { label: '480 No answer',  cls: 'bg-amber-50  text-amber-700   border-amber-100   dark:bg-amber-900/20  dark:text-amber-400   dark:border-amber-800' },
    486: { label: '486 Busy',       cls: 'bg-amber-50  text-amber-700   border-amber-100   dark:bg-amber-900/20  dark:text-amber-400   dark:border-amber-800' },
    487: { label: '487 Cancelled',  cls: 'bg-red-50    text-red-700     border-red-100     dark:bg-red-900/20    dark:text-red-400     dark:border-red-800' },
    404: { label: '404 Not found',  cls: 'bg-red-50    text-red-700     border-red-100     dark:bg-red-900/20    dark:text-red-400     dark:border-red-800' },
    403: { label: '403 Rejected',   cls: 'bg-red-50    text-red-700     border-red-100     dark:bg-red-900/20    dark:text-red-400     dark:border-red-800' },
    408: { label: '408 Timeout',    cls: 'bg-amber-50  text-amber-700   border-amber-100   dark:bg-amber-900/20  dark:text-amber-400   dark:border-amber-800' },
    500: { label: '500 Error',      cls: 'bg-red-50    text-red-700     border-red-100     dark:bg-red-900/20    dark:text-red-400     dark:border-red-800' },
    503: { label: '503 Unavail',    cls: 'bg-red-50    text-red-700     border-red-100     dark:bg-red-900/20    dark:text-red-400     dark:border-red-800' },
  };
  const entry = map[code];
  if (entry) {
    return (
      <span className={`inline-block font-mono text-[10px] px-2 py-0.5 rounded border ${entry.cls}`}>
        {entry.label}
      </span>
    );
  }
  const fallback = hangupCause ? (HANGUP_CAUSE_VI[hangupCause] ?? hangupCause) : null;
  if (!fallback) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-block font-mono text-[10px] px-2 py-0.5 rounded border bg-muted text-muted-foreground border-border">
      {fallback}
    </span>
  );
}

export default function CallLogListPage() {
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canDeleteRecording = hasPermission('recording.delete');
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  // Recording đang được mở popover phát inline (chỉ 1 cái mở 1 lúc)
  const [playingRecId, setPlayingRecId] = useState<string | null>(null);
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
      // THỜI GIAN — mono datetime matching mockup yyyy-MM-dd HH:mm:ss
      key: 'startTime', label: 'THỜI GIAN', sortable: true,
      render: (row) => (
        <span className="font-mono text-xs text-on-surface-variant whitespace-nowrap">
          {format(new Date(row.startTime), 'yyyy-MM-dd HH:mm:ss')}
        </span>
      ),
    },
    {
      // HƯỚNG — icon only, no text pill
      key: 'direction', label: 'HƯỚNG',
      render: (row) => {
        const inbound = row.direction === 'inbound';
        return inbound
          ? <ArrowDownLeft className="h-4 w-4 text-primary" />
          : <ArrowUpRight className="h-4 w-4 text-primary" />;
      },
    },
    {
      // CALLER — name bold + phone mono below
      key: 'callerNumber', label: 'CALLER',
      render: (row) => {
        const phone = fmtPhone(row.direction === 'inbound' ? row.callerNumber : (row.destinationNumber || ''));
        const name = null; // CallLog list doesn't carry contact name — show number only
        return (
          <div>
            {name && <div className="text-sm font-semibold leading-tight">{name}</div>}
            <div className="font-mono text-[11px] text-muted-foreground">{phone || '—'}</div>
          </div>
        );
      },
    },
    {
      // DESTINATION — agent extension / destination
      key: 'destinationNumber', label: 'DESTINATION',
      render: (row) => (
        <span className="font-mono text-xs">
          {fmtPhone(row.direction === 'inbound' ? (row.destinationNumber || '') : row.callerNumber) || '—'}
        </span>
      ),
    },
    {
      // AGENT — avatar initial + name
      key: 'user', label: 'AGENT',
      render: (row) => {
        const name = row.user?.fullName;
        if (!name) return <span className="text-muted-foreground">—</span>;
        const initials = name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
        return (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-accent text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
              {initials}
            </div>
            <span className="text-sm">{name}</span>
          </div>
        );
      },
    },
    {
      // THỜI LƯỢNG — mono, center
      key: 'duration', label: 'THỜI LƯỢNG', sortable: true,
      render: (row) => (
        <span className="font-mono text-xs tabular-nums">{formatDuration(row.duration)}</span>
      ),
    },
    {
      // SIP STATUS — bordered pill "200 OK" / "486 Busy"
      key: 'hangupCause', label: 'SIP STATUS',
      render: (row) => <SipStatusPill sipCode={row.sipCode} hangupCause={row.hangupCause} />,
    },
    {
      // DISPOSITION — text with inline edit + save (existing state machine)
      key: 'status', label: 'DISPOSITION',
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
              <SelectTrigger className="h-7 w-40 text-xs border-0 shadow-none px-1 hover:bg-muted/50">
                {label
                  ? <span className={`text-sm ${isDirty ? 'text-amber-600 font-medium' : ''}`}>{label}</span>
                  : <span className="text-muted-foreground text-xs">—</span>}
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
                className="h-6 w-6 text-emerald-600 hover:text-emerald-700"
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
      // GHI ÂM — Mic là button mở popover phát inline (KHÔNG mở popup detail)
      key: 'recordingStatus', label: 'GHI ÂM',
      render: (row) => row.recordingStatus === 'available'
        ? (
          <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
            <Popover
              open={playingRecId === row.id}
              onOpenChange={(open) => setPlayingRecId(open ? row.id : null)}
            >
              <PopoverTrigger
                render={(props) => (
                  <button
                    {...props}
                    type="button"
                    title="Nghe ghi âm"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent text-primary transition-colors cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); setPlayingRecId(playingRecId === row.id ? null : row.id); }}
                  >
                    <Mic className="h-4 w-4" />
                  </button>
                )}
              />
              <PopoverContent
                className="w-[360px] p-0 overflow-hidden border border-border shadow-lg"
                side="left"
                align="center"
              >
                {playingRecId === row.id && (
                  <div>
                    {/* Header — số khách → ext agent (theo direction), kèm time + duration */}
                    {(() => {
                      // Match convention bảng: CALLER col luôn là số external, DESTINATION luôn là ext agent
                      const externalNum = row.direction === 'inbound' ? row.callerNumber : (row.destinationNumber || '');
                      const agentExt = row.direction === 'inbound' ? (row.destinationNumber || '') : row.callerNumber;
                      const arrow = row.direction === 'inbound' ? '→' : '←';
                      return (
                        <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-accent/40 border-b border-dashed border-border">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 shrink-0">
                              <Mic className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-mono text-xs font-semibold text-foreground truncate">
                                {fmtPhone(externalNum)}
                                {agentExt && (
                                  <span className="text-muted-foreground"> {arrow} Ext {agentExt}</span>
                                )}
                              </p>
                              <p className="font-mono text-[10px] text-muted-foreground">
                                {format(new Date(row.startTime), 'dd/MM HH:mm')} · {formatDuration(row.billsec ?? row.duration)}
                              </p>
                            </div>
                          </div>
                          <span className="font-mono text-[9px] uppercase tracking-widest text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">
                            Recording
                          </span>
                        </div>
                      );
                    })()}

                    {/* Player */}
                    <div className="p-3">
                      <AudioPlayer
                        src={`${window.location.origin}/api/v1/call-logs/${row.id}/recording?token=${getAccessToken()}`}
                      />
                    </div>
                  </div>
                )}
              </PopoverContent>
            </Popover>
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

  // Mockup 06 filter toolbar: 5 labeled inputs + search button
  const toolbar = (
    <div
      className="flex items-end gap-3 flex-wrap"
      onKeyDown={(e) => { if (e.key === 'Enter') applyFilters(); }}
    >
      {/* SỐ ĐÍCH */}
      <div className="space-y-1">
        <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Số đích</Label>
        <Input
          placeholder="090..."
          value={destSearchDraft}
          onChange={(e) => setDestSearchDraft(e.target.value)}
          className="w-36 h-9"
        />
      </div>
      {/* HƯỚNG */}
      <div className="space-y-1">
        <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Hướng</Label>
        <Select value={draftDirection || undefined} onValueChange={(v) => setDraftDirection(v === '_all' ? '' : v || '')}>
          <SelectTrigger className="w-36 h-9">
            {draftDirection
              ? <span>{draftDirection === 'inbound' ? VI.callLog.inbound : VI.callLog.outbound}</span>
              : <span className="text-muted-foreground">Tất cả</span>}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Tất cả</SelectItem>
            <SelectItem value="inbound">{VI.callLog.inbound}</SelectItem>
            <SelectItem value="outbound">{VI.callLog.outbound}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {/* TRẠNG THÁI */}
      <div className="space-y-1">
        <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Trạng thái</Label>
        <Select value={draftResult || undefined} onValueChange={(v) => setDraftResult(v === '_all' ? '' : v || '')}>
          <SelectTrigger className="w-40 h-9">
            {draftResult
              ? <span>{HANGUP_CAUSE_VI[draftResult] ?? draftResult}</span>
              : <span className="text-muted-foreground">Tất cả</span>}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Tất cả</SelectItem>
            <SelectItem value="NORMAL_CLEARING">Thành công</SelectItem>
            <SelectItem value="NO_ANSWER">Không trả lời</SelectItem>
            <SelectItem value="USER_BUSY">Máy bận</SelectItem>
            <SelectItem value="ORIGINATOR_CANCEL">Hủy</SelectItem>
            <SelectItem value="CALL_REJECTED">Từ chối</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {/* NHÂN VIÊN */}
      <div className="space-y-1">
        <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Nhân viên</Label>
        <Select value={draftAgent || undefined} onValueChange={(v) => setDraftAgent(v === '_all' ? '' : v || '')}>
          <SelectTrigger className="w-40 h-9">
            {draftAgent
              ? <span>{agents.find((a) => a.id === draftAgent)?.fullName ?? '—'}</span>
              : <span className="text-muted-foreground">Chọn nhân viên</span>}
          </SelectTrigger>
          <SelectContent className="max-h-80">
            <SelectItem value="_all">Tất cả nhân viên</SelectItem>
            {agents
              .filter((a) => a.sipExtension)
              .sort((a, b) => (a.sipExtension ?? '').localeCompare(b.sipExtension ?? '', undefined, { numeric: true }))
              .map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.fullName}{a.sipExtension ? ` (${a.sipExtension})` : ''}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
      {/* KHOẢNG THỜI GIAN — date pair */}
      <div className="space-y-1">
        <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Từ ngày</Label>
        <Input type="date" value={draftDateFrom} onChange={(e) => setDraftDateFrom(e.target.value)} className="w-36 h-9" />
      </div>
      <div className="space-y-1">
        <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Đến ngày</Label>
        <Input type="date" value={draftDateTo} onChange={(e) => setDraftDateTo(e.target.value)} className="w-36 h-9" />
      </div>
      {/* Search button — violet filled, icon only style matching mockup */}
      <Button
        className="h-9 px-4 bg-primary text-white hover:bg-primary/90 font-semibold"
        onClick={applyFilters}
        disabled={!hasDraftChanges}
      >
        <Search className="h-4 w-4 mr-1.5" />Tìm kiếm
      </Button>
      {hasFilters && (
        <Button variant="ghost" size="sm" className="h-9" onClick={handleClearFilters}>Xóa lọc</Button>
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
