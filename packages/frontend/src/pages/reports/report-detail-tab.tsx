/** Tab 2: Chi tiết — paginated call detail table with recording column */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Play } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ReportExportButton } from './report-export-button';
import { formatDuration } from '@/lib/format';
import api from '@/services/api-client';
import { format } from 'date-fns';
import type { FilterState } from './report-filters';
import { VI } from '@/lib/vi-text';

interface DetailRow {
  id: string;
  startTime: string;
  agentName: string;
  callerNumber: string;
  destinationNumber: string;
  duration: number;
  billsec: number;
  hangupCause: string;
  sipCode: string;
  recordingPath?: string;
  recordingStatus?: string;
}

interface DetailResponse {
  data: DetailRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

interface Props {
  filters: FilterState;
  searched: boolean;
  queryKey: unknown[];
}

const HANGUP_VI = VI.hangupCause;

const EXPORT_HEADERS = [
  { key: 'startTime', label: 'Thời gian' },
  { key: 'agentName', label: 'Nhân viên' },
  { key: 'callerNumber', label: 'Số gọi' },
  { key: 'destinationNumber', label: 'Số nhận' },
  { key: 'duration', label: 'Thời lượng' },
  { key: 'billsec', label: 'Thời gian nói' },
  { key: 'hangupCause', label: 'Kết quả' },
  { key: 'sipCode', label: 'SIP Code' },
];

const PAGE_SIZES = [20, 50, 100];

export function ReportDetailTab({ filters, searched, queryKey }: Props) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [hangupCause, setHangupCause] = useState('');
  const [sipCode, setSipCode] = useState('');

  const params = {
    start_date: filters.dateFrom,
    end_date: filters.dateTo,
    ...(filters.userId && { user_id: filters.userId }),
    ...(filters.teamId && { team_id: filters.teamId }),
    ...(hangupCause && { hangup_cause: hangupCause }),
    ...(sipCode && { sip_code: sipCode }),
    page,
    limit,
  };

  const { data, isFetching } = useQuery<DetailResponse>({
    queryKey: [...queryKey, 'detail', page, limit, hangupCause, sipCode],
    queryFn: () => api.get('/reports/calls/detail', { params }).then((r) => r.data as DetailResponse),
    enabled: searched,
  });

  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  if (!searched) {
    return (
      <div className="space-y-3">
        <DetailExtraFilters
          hangupCause={hangupCause} onHangupCause={setHangupCause}
          sipCode={sipCode} onSipCode={setSipCode}
        />
        <p className="text-muted-foreground text-sm py-8 text-center">Nhấn Tìm kiếm để xem báo cáo</p>
      </div>
    );
  }

  const exportRows = rows.map((r) => ({
    startTime: format(new Date(r.startTime), 'dd/MM/yyyy HH:mm:ss'),
    agentName: r.agentName,
    callerNumber: r.callerNumber,
    destinationNumber: r.destinationNumber,
    duration: formatDuration(r.duration),
    billsec: formatDuration(r.billsec),
    hangupCause: HANGUP_VI[r.hangupCause] ?? r.hangupCause,
    sipCode: r.sipCode,
  })) as Record<string, unknown>[];

  return (
    <div className="space-y-3">
      <DetailExtraFilters
        hangupCause={hangupCause} onHangupCause={setHangupCause}
        sipCode={sipCode} onSipCode={setSipCode}
      />

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {pagination
            ? `Trang ${pagination.page} / ${pagination.totalPages} — Tổng ${pagination.total} bản ghi`
            : ''}
        </span>
        <ReportExportButton rows={exportRows} headers={EXPORT_HEADERS} fileName="bao-cao-chi-tiet" />
      </div>

      <Card><CardContent className="p-0">
        {isFetching ? <Skeleton className="h-64 w-full rounded-t-none" /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thời gian</TableHead>
                <TableHead>Nhân viên</TableHead>
                <TableHead>Số gọi</TableHead>
                <TableHead>Số nhận</TableHead>
                <TableHead className="text-right">Thời lượng</TableHead>
                <TableHead className="text-right">Thời gian nói</TableHead>
                <TableHead>Kết quả</TableHead>
                <TableHead>SIP Code</TableHead>
                <TableHead>Ghi âm</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {format(new Date(r.startTime), 'dd/MM/yyyy HH:mm:ss')}
                  </TableCell>
                  <TableCell>{r.agentName}</TableCell>
                  <TableCell>{r.callerNumber}</TableCell>
                  <TableCell>{r.destinationNumber}</TableCell>
                  <TableCell className="text-right">{formatDuration(r.duration)}</TableCell>
                  <TableCell className="text-right">{formatDuration(r.billsec)}</TableCell>
                  <TableCell>{HANGUP_VI[r.hangupCause] ?? r.hangupCause}</TableCell>
                  <TableCell>{r.sipCode}</TableCell>
                  <TableCell>
                    {r.recordingStatus === 'available'
                      ? <Play className="h-4 w-4 text-indigo-500 cursor-pointer" />
                      : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground h-16">Không có dữ liệu</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent></Card>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Dòng/trang</Label>
            <Select value={String(limit)} onValueChange={(v) => { setLimit(Number(v ?? '50')); setPage(1); }}>
              <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Trước</Button>
            <Button variant="outline" size="sm" disabled={page >= (pagination.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)}>Tiếp</Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Extra filters specific to detail tab rendered inside the tab content */
function DetailExtraFilters({
  hangupCause, onHangupCause, sipCode, onSipCode,
}: {
  hangupCause: string; onHangupCause: (v: string) => void;
  sipCode: string; onSipCode: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label className="text-xs">Kết quả</Label>
        <Select value={hangupCause} onValueChange={(v) => onHangupCause(v ?? '')}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Tất cả">
              {hangupCause ? (HANGUP_VI[hangupCause] ?? hangupCause) : 'Tất cả'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Tất cả</SelectItem>
            {Object.entries(HANGUP_VI).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">SIP Code</Label>
        <Input
          placeholder="VD: 200"
          value={sipCode}
          onChange={(e) => onSipCode(e.target.value)}
          className="w-28"
        />
      </div>
    </div>
  );
}
