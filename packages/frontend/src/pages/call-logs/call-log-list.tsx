import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { PageWrapper } from '@/components/page-wrapper';
import { DataTable, type Column } from '@/components/data-table/data-table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePagination } from '@/hooks/use-pagination';
import api from '@/services/api-client';
import { VI } from '@/lib/vi-text';
import { formatDuration } from '@/lib/format';

interface CallLog {
  id: string;
  callerNumber: string;
  calleeNumber: string;
  direction: 'inbound' | 'outbound';
  duration: number;
  disposition?: string;
  startTime: string;
  agent?: { fullName: string };
}

export default function CallLogListPage() {
  const navigate = useNavigate();
  const [directionFilter, setDirectionFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const { page, setPage, limit, setLimit, search, setSearch, sortKey, sortOrder, handleSort, queryParams } = usePagination();

  const { data, isLoading } = useQuery({
    queryKey: ['call-logs', queryParams, directionFilter, dateFrom, dateTo],
    queryFn: async () => {
      const params: Record<string, string | number> = { ...queryParams };
      if (directionFilter) params.direction = directionFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const { data } = await api.get('/call-logs', { params });
      return data.data as { items: CallLog[]; total: number };
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
    { key: 'callerNumber', label: 'Số gọi' },
    { key: 'calleeNumber', label: 'Số nhận' },
    { key: 'agent', label: VI.callLog.agent, render: (row) => row.agent?.fullName ?? '—' },
    { key: 'duration', label: VI.callLog.duration, sortable: true, render: (row) => formatDuration(row.duration) },
    { key: 'disposition', label: VI.callLog.disposition, render: (row) => row.disposition || '—' },
    {
      key: 'startTime', label: VI.callLog.startTime, sortable: true,
      render: (row) => format(new Date(row.startTime), 'dd/MM/yyyy HH:mm'),
    },
  ];

  const toolbar = (
    <div className="flex items-end gap-2">
      <Select value={directionFilter || 'all'} onValueChange={(v) => setDirectionFilter(!v || v === 'all' ? '' : v)}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder={VI.callLog.direction} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{VI.actions.filter} — {VI.callLog.direction}</SelectItem>
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
        searchValue={search}
        onSearchChange={setSearch}
        onPageChange={setPage}
        onLimitChange={setLimit}
        onSort={handleSort}
        sortKey={sortKey}
        sortOrder={sortOrder}
        onRowClick={(row) => navigate(`/call-logs/${row.id}`)}
        toolbar={toolbar}
      />
    </PageWrapper>
  );
}
