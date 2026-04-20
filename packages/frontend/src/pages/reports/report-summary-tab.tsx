/** Tab 1: Tóm tắt — sub-tabs Theo nhân viên / Theo team */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ReportExportButton } from './report-export-button';
import { formatDuration } from '@/lib/format';
import api from '@/services/api-client';
import type { FilterState } from './report-filters';
import { DottedCard } from '@/components/ops/dotted-card';

interface AgentRow {
  agentId: string;
  agentName: string;
  teamName: string;
  totalCalls: number;
  answered: number;
  missed: number;
  cancelled: number;
  avgDuration: number;
  avgBillsec: number;
  answerRate: number;
}

interface TeamRow {
  teamId: string;
  teamName: string;
  agentCount: number;
  totalCalls: number;
  answered: number;
  missed: number;
  answerRate: number;
}

interface Props {
  filters: FilterState;
  searched: boolean;
  queryKey: unknown[];
}

const AGENT_HEADERS = [
  { key: 'agentName', label: 'Nhân viên' },
  { key: 'teamName', label: 'Team' },
  { key: 'totalCalls', label: 'Tổng cuộc gọi' },
  { key: 'answered', label: 'Đã nghe' },
  { key: 'missed', label: 'Nhỡ' },
  { key: 'cancelled', label: 'Hủy' },
  { key: 'avgDuration', label: 'Thời lượng TB' },
  { key: 'avgBillsec', label: 'Thời gian nói TB' },
  { key: 'answerRate', label: 'Tỷ lệ nghe %' },
];

const TEAM_HEADERS = [
  { key: 'teamName', label: 'Team' },
  { key: 'agentCount', label: 'Số agent' },
  { key: 'totalCalls', label: 'Tổng cuộc gọi' },
  { key: 'answered', label: 'Đã nghe' },
  { key: 'missed', label: 'Nhỡ' },
  { key: 'answerRate', label: 'Tỷ lệ nghe %' },
];

function pct(rate: number) { return `${(rate * 100).toFixed(1)}%`; }

export function ReportSummaryTab({ filters, searched, queryKey }: Props) {
  const [subTab, setSubTab] = useState('agent');

  const params = {
    start_date: filters.dateFrom,
    end_date: filters.dateTo,
    ...(filters.userId && { user_id: filters.userId }),
    ...(filters.teamId && { team_id: filters.teamId }),
  };

  const { data: agentRows, isFetching: loadingAgent } = useQuery<AgentRow[]>({
    queryKey: [...queryKey, 'agent'],
    queryFn: () => api.get<{ data: AgentRow[] }>('/reports/calls/summary', { params }).then((r) => r.data.data),
    enabled: searched,
  });

  const { data: teamRows, isFetching: loadingTeam } = useQuery<TeamRow[]>({
    queryKey: [...queryKey, 'team'],
    queryFn: () => api.get<{ data: TeamRow[] }>('/reports/calls/summary-by-team', { params }).then((r) => r.data.data),
    enabled: searched,
  });

  if (!searched) {
    return <p className="text-muted-foreground text-sm py-8 text-center">Nhấn Tìm kiếm để xem báo cáo</p>;
  }

  const agentExportRows = (agentRows ?? []).map((r) => ({
    ...r,
    avgDuration: formatDuration(r.avgDuration),
    avgBillsec: formatDuration(r.avgBillsec),
    answerRate: pct(r.answerRate),
  })) as Record<string, unknown>[];

  const teamExportRows = (teamRows ?? []).map((r) => ({
    ...r,
    answerRate: pct(r.answerRate),
  })) as Record<string, unknown>[];

  return (
    <Tabs value={subTab} onValueChange={setSubTab}>
      <div className="flex items-center justify-between mb-3">
        <TabsList>
          <TabsTrigger value="agent">Theo nhân viên</TabsTrigger>
          <TabsTrigger value="team">Theo team</TabsTrigger>
        </TabsList>
        {subTab === 'agent'
          ? <ReportExportButton rows={agentExportRows} headers={AGENT_HEADERS} fileName="bao-cao-tom-tat" />
          : <ReportExportButton rows={teamExportRows} headers={TEAM_HEADERS} fileName="bao-cao-theo-team" />
        }
      </div>

      <TabsContent value="agent">
        <DottedCard className="p-0 overflow-hidden">
          {loadingAgent ? <Skeleton className="h-48 w-full" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nhân viên</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead className="text-right">Tổng</TableHead>
                  <TableHead className="text-right">Đã nghe</TableHead>
                  <TableHead className="text-right">Nhỡ</TableHead>
                  <TableHead className="text-right">Hủy</TableHead>
                  <TableHead className="text-right">TL TB</TableHead>
                  <TableHead className="text-right">Nói TB</TableHead>
                  <TableHead className="text-right">Tỷ lệ nghe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agentRows?.map((r) => (
                  <TableRow key={r.agentId}>
                    <TableCell className="font-medium">{r.agentName}</TableCell>
                    <TableCell>{r.teamName}</TableCell>
                    <TableCell className="text-right">{r.totalCalls}</TableCell>
                    <TableCell className="text-right text-[var(--color-status-ok)]">{r.answered}</TableCell>
                    <TableCell className="text-right text-[var(--color-status-err)]">{r.missed}</TableCell>
                    <TableCell className="text-right text-[var(--color-status-warn)]">{r.cancelled}</TableCell>
                    <TableCell className="text-right">{formatDuration(r.avgDuration)}</TableCell>
                    <TableCell className="text-right">{formatDuration(r.avgBillsec)}</TableCell>
                    <TableCell className="text-right">{pct(r.answerRate)}</TableCell>
                  </TableRow>
                ))}
                {!agentRows?.length && (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground h-16">Không có dữ liệu</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </DottedCard>
      </TabsContent>

      <TabsContent value="team">
        <DottedCard className="p-0 overflow-hidden">
          {loadingTeam ? <Skeleton className="h-48 w-full" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team</TableHead>
                  <TableHead className="text-right">Số agent</TableHead>
                  <TableHead className="text-right">Tổng</TableHead>
                  <TableHead className="text-right">Đã nghe</TableHead>
                  <TableHead className="text-right">Nhỡ</TableHead>
                  <TableHead className="text-right">Tỷ lệ nghe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamRows?.map((r) => (
                  <TableRow key={r.teamId}>
                    <TableCell className="font-medium">{r.teamName}</TableCell>
                    <TableCell className="text-right">{r.agentCount}</TableCell>
                    <TableCell className="text-right">{r.totalCalls}</TableCell>
                    <TableCell className="text-right text-[var(--color-status-ok)]">{r.answered}</TableCell>
                    <TableCell className="text-right text-[var(--color-status-err)]">{r.missed}</TableCell>
                    <TableCell className="text-right">{pct(r.answerRate)}</TableCell>
                  </TableRow>
                ))}
                {!teamRows?.length && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground h-16">Không có dữ liệu</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </DottedCard>
      </TabsContent>
    </Tabs>
  );
}
