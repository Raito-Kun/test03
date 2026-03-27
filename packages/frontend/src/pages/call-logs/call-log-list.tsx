import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Mic } from 'lucide-react';
import { PageWrapper } from '@/components/page-wrapper';
import { DataTable, type Column } from '@/components/data-table/data-table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePagination } from '@/hooks/use-pagination';
import api from '@/services/api-client';
import { VI } from '@/lib/vi-text';
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
  user?: { fullName: string };
  dispositionCode?: { label: string };
}

export default function CallLogListPage() {
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [directionFilter, setDirectionFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const { page, setPage, limit, setLimit, sortKey, sortOrder, handleSort, queryParams } = usePagination();

  const { data, isLoading } = useQuery({
    queryKey: ['call-logs', queryParams, directionFilter, dateFrom, dateTo, appliedSearch],
    queryFn: async () => {
      const params: Record<string, string | number> = { ...queryParams, search: appliedSearch };
      if (directionFilter) params.direction = directionFilter;
      if (dateFrom) params.dateFrom = `${dateFrom}T00:00:00`;
      if (dateTo) params.dateTo = `${dateTo}T23:59:59`;
      const { data: resp } = await api.get('/call-logs', { params });
      return { items: resp.data as CallLog[], total: resp.meta?.total ?? 0 };
    },
  });

  const columns: Column<CallLog>[] = [
    {
      key: 'direction', label: VI.callLog.direction,
      render: (row) => (
        <Badge variant={row.direction === 'inbound' ? 'default' : 'secondary'}>
          {row.direction === 'inbound' ? VI.callLog.inbound : VI.callLog.outbound}
        </Badge>
      ),
    },
    { key: 'callerNumber', label: 'Số gọi', render: (row) => fmtPhone(row.callerNumber) },
    { key: 'destinationNumber', label: 'Số nhận', render: (row) => fmtPhone(row.destinationNumber) || '—' },
    { key: 'user', label: VI.callLog.agent, render: (row) => row.user?.fullName ?? '—' },
    { key: 'duration', label: VI.callLog.duration, sortable: true, render: (row) => formatDuration(row.duration) },
    { key: 'billsec', label: 'Thời gian nói', render: (row) => row.billsec != null ? formatDuration(row.billsec) : '—' },
    {
      key: 'recordingStatus', label: 'Ghi âm',
      render: (row) => row.recordingStatus === 'available'
        ? <Mic className="h-4 w-4 text-green-500" />
        : <span className="text-muted-foreground text-xs">—</span>,
    },
    { key: 'disposition', label: VI.callLog.disposition, render: (row) => row.dispositionCode?.label || row.disposition || '—' },
    {
      key: 'hangupCause', label: 'Kết quả',
      render: (row) => {
        const sip = row.sipCode ? parseInt(row.sipCode, 10) : 0;
        if (sip >= 400) return row.sipReason || `Lỗi SIP ${row.sipCode}`;
        return row.hangupCause ? (HANGUP_CAUSE_VI[row.hangupCause] ?? row.hangupCause) : '—';
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
  }

  const toolbar = (
    <div className="flex items-end gap-2">
      <Select value={directionFilter || 'all'} onValueChange={(v) => setDirectionFilter(!v || v === 'all' ? '' : v)}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder={VI.callLog.direction} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tất cả hướng</SelectItem>
          <SelectItem value="inbound">{VI.callLog.inbound}</SelectItem>
          <SelectItem value="outbound">{VI.callLog.outbound}</SelectItem>
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
      {(directionFilter || dateFrom || dateTo) && (
        <Button variant="ghost" size="sm" onClick={handleClearFilters}>Xóa lọc</Button>
      )}
    </div>
  );

  return (
    <PageWrapper title={VI.callLog.title}>
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
    </PageWrapper>
  );
}
