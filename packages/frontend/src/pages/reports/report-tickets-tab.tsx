/** Tab 4: Báo cáo phiếu ghi — tickets grouped by creator (agent) */
import { useQuery } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ReportExportButton } from './report-export-button';
import api from '@/services/api-client';
import type { FilterState } from './report-filters';
import { DottedCard } from '@/components/ops/dotted-card';

interface TicketAgentRow {
  agentId: string;
  agentName: string;
  teamName: string;
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  slaBreached: number;
  avgResolutionHours: number;
}

interface Props {
  filters: FilterState;
  searched: boolean;
  queryKey: unknown[];
}

const HEADERS = [
  { key: 'agentName', label: 'Nhân viên' },
  { key: 'teamName', label: 'Nhóm' },
  { key: 'total', label: 'Tổng phiếu' },
  { key: 'open', label: 'Chưa xử lý' },
  { key: 'inProgress', label: 'Đang xử lý' },
  { key: 'resolved', label: 'Đã xử lý' },
  { key: 'closed', label: 'Đã đóng' },
  { key: 'slaBreached', label: 'Vi phạm SLA' },
  { key: 'avgResolutionHours', label: 'TB xử lý (giờ)' },
];

export function ReportTicketsTab({ filters, searched, queryKey }: Props) {
  const params = {
    start_date: filters.dateFrom,
    end_date: filters.dateTo,
    ...(filters.userId && { user_id: filters.userId }),
    ...(filters.teamId && { team_id: filters.teamId }),
  };

  const { data: rows, isFetching } = useQuery<TicketAgentRow[]>({
    queryKey: [...queryKey, 'tickets'],
    queryFn: () => api.get<{ data: TicketAgentRow[] }>('/reports/tickets/summary', { params }).then((r) => r.data.data),
    enabled: searched,
  });

  if (!searched) {
    return <p className="text-muted-foreground text-sm py-8 text-center">Nhấn Tìm kiếm để xem báo cáo</p>;
  }

  const exportRows = (rows ?? []) as unknown as Record<string, unknown>[];

  return (
    <div>
      <div className="flex items-center justify-end mb-3">
        <ReportExportButton rows={exportRows} headers={HEADERS} fileName="bao-cao-phieu-ghi" />
      </div>
      <DottedCard className="p-0 overflow-hidden">
        {isFetching ? <Skeleton className="h-48 w-full" /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nhân viên</TableHead>
                <TableHead>Nhóm</TableHead>
                <TableHead className="text-right">Tổng</TableHead>
                <TableHead className="text-right">Chưa XL</TableHead>
                <TableHead className="text-right">Đang XL</TableHead>
                <TableHead className="text-right">Đã XL</TableHead>
                <TableHead className="text-right">Đã đóng</TableHead>
                <TableHead className="text-right">SLA vi phạm</TableHead>
                <TableHead className="text-right">TB xử lý (h)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows?.map((r) => (
                <TableRow key={r.agentId}>
                  <TableCell className="font-medium">{r.agentName}</TableCell>
                  <TableCell>{r.teamName}</TableCell>
                  <TableCell className="text-right">{r.total}</TableCell>
                  <TableCell className="text-right text-[var(--color-status-warn)]">{r.open}</TableCell>
                  <TableCell className="text-right">{r.inProgress}</TableCell>
                  <TableCell className="text-right text-[var(--color-status-ok)]">{r.resolved}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{r.closed}</TableCell>
                  <TableCell className="text-right text-[var(--color-status-err)]">{r.slaBreached}</TableCell>
                  <TableCell className="text-right">{r.avgResolutionHours > 0 ? r.avgResolutionHours : '—'}</TableCell>
                </TableRow>
              ))}
              {!rows?.length && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground h-16">Không có dữ liệu</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </DottedCard>
    </div>
  );
}
