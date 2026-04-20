/* call-log-list v11 — ops restyle */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Mic, RefreshCw, Download, CheckSquare } from 'lucide-react';
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
  dispositionCode?: { label: string };
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
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [directionFilter, setDirectionFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  // Enhanced filters
  const [agentFilter, setAgentFilter] = useState('');

  // Agent dropdown source — cluster-scoped on backend
  const { data: agents = [] } = useQuery<AgentOption[]>({
    queryKey: ['call-log-agents'],
    queryFn: () => api.get('/users', { params: { limit: 200 } }).then((r) => r.data.data as AgentOption[]),
    staleTime: 5 * 60_000,
  });
  const [resultFilter, setResultFilter] = useState('');
  const [sipCodeFilter, setSipCodeFilter] = useState('');
  const [callTypeFilter, setCallTypeFilter] = useState('');
  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const { page, setPage, limit, setLimit, sortKey, sortOrder, handleSort, queryParams } = usePagination();

  const { data, isLoading } = useQuery({
    queryKey: ['call-logs', queryParams, directionFilter, dateFrom, dateTo, appliedSearch, agentFilter, resultFilter, sipCodeFilter, callTypeFilter],
    queryFn: async () => {
      const params: Record<string, string | number> = { ...queryParams, search: appliedSearch };
      if (directionFilter) params.direction = directionFilter;
      if (dateFrom) params.dateFrom = `${dateFrom}T00:00:00`;
      if (dateTo) params.dateTo = `${dateTo}T23:59:59`;
      if (agentFilter) params.userId = agentFilter;
      if (resultFilter) params.hangupCause = resultFilter;
      if (sipCodeFilter) params.sipCode = sipCodeFilter;
      if (callTypeFilter) params.callType = callTypeFilter;
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
        ? <Mic className="h-4 w-4 text-green-500" />
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
      key: 'sipReason', label: 'SIP Reason',
      render: (row) => {
        // Derive from SIP code (authoritative) with hangupCause fallback
        const code = row.sipCode ? parseInt(row.sipCode, 10) : 0;
        if (code === 200) return 'Answer';
        if (code === 430) return 'Voicemail';
        if (code === 486) return 'Busy';
        if (code === 487) return 'Request Terminated';
        if (code === 480) return 'No Answer';
        if (code === 404) return 'Not Found';
        if (code === 403) return 'Forbidden';
        if (code === 408) return 'Request Timeout';
        if (code === 500) return 'Internal Server Error';
        if (code === 503) return 'Service Unavailable';
        // No SIP code → derive from hangupCause
        if (row.hangupCause === 'ORIGINATOR_CANCEL') return 'Request Terminated';
        if (row.hangupCause === 'NO_ANSWER') return 'No Answer';
        if (row.hangupCause === 'NORMAL_CLEARING') return 'Answer';
        if (row.hangupCause === 'USER_BUSY') return 'Busy';
        if (!row.hangupCause && !row.sipReason) return '—';
        return row.sipReason || '—';
      },
    },
    {
      key: 'disposition', label: 'Phân loại',
      render: (row) => {
        if (row.dispositionCode?.label) return row.dispositionCode.label;
        const source = (row.notes || row.disposition || '').trim();
        // Anything that's not c2c / autocall is treated as a manual call
        const key = source === 'c2c' || source === 'autocall' ? source : 'manual';
        const CALL_SOURCE_VI: Record<string, string> = { c2c: 'C2C', autocall: 'Auto Call', manual: 'Thủ công' };
        return CALL_SOURCE_VI[key];
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
    setDirectionFilter('');
    setDateFrom('');
    setDateTo('');
    setAgentFilter('');
    setResultFilter('');
    setSipCodeFilter('');
    setCallTypeFilter('');
  }

  const hasFilters = directionFilter || dateFrom || dateTo || agentFilter || resultFilter || sipCodeFilter || callTypeFilter;

  const CALL_TYPE_VI: Record<string, string> = { c2c: 'C2C', autocall: 'Auto Call', manual: 'Thủ công' };

  const toolbar = (
    <div className="flex items-end gap-2 flex-wrap">
      <Select value={directionFilter || undefined} onValueChange={(v) => setDirectionFilter(v === '_all' ? '' : v || '')}>
        <SelectTrigger className="w-36">
          {directionFilter
            ? <span>{directionFilter === 'inbound' ? VI.callLog.inbound : VI.callLog.outbound}</span>
            : <span className="text-muted-foreground">Tất cả hướng</span>}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Tất cả hướng</SelectItem>
          <SelectItem value="inbound">{VI.callLog.inbound}</SelectItem>
          <SelectItem value="outbound">{VI.callLog.outbound}</SelectItem>
        </SelectContent>
      </Select>
      <Select value={resultFilter || undefined} onValueChange={(v) => setResultFilter(v === '_all' ? '' : v || '')}>
        <SelectTrigger className="w-44">
          {resultFilter
            ? <span>{HANGUP_CAUSE_VI[resultFilter] ?? resultFilter}</span>
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
      <Select value={callTypeFilter || undefined} onValueChange={(v) => setCallTypeFilter(v === '_all' ? '' : v || '')}>
        <SelectTrigger className="w-40">
          {callTypeFilter
            ? <span>{CALL_TYPE_VI[callTypeFilter] ?? callTypeFilter}</span>
            : <span className="text-muted-foreground">Tất cả phân loại</span>}
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">Tất cả phân loại</SelectItem>
          <SelectItem value="c2c">C2C</SelectItem>
          <SelectItem value="autocall">Auto Call</SelectItem>
          <SelectItem value="manual">Thủ công</SelectItem>
        </SelectContent>
      </Select>
      <Select value={agentFilter || undefined} onValueChange={(v) => setAgentFilter(v === '_all' ? '' : v || '')}>
        <SelectTrigger className="w-36">
          {agentFilter
            ? <span>{agents.find((a) => a.id === agentFilter)?.sipExtension ?? '—'}</span>
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
        <Input placeholder="VD: 200, 486" value={sipCodeFilter} onChange={(e) => setSipCodeFilter(e.target.value)} className="w-28" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Từ ngày</Label>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Đến ngày</Label>
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" />
      </div>
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
        onSearchSubmit={(v) => { setAppliedSearch(v); setPage(1); }}
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
