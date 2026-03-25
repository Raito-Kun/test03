import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { VI } from '@/lib/vi-text';
import { formatDuration, formatPercent } from '@/lib/format';
import api from '@/services/api-client';

interface CallReportRow {
  agentName: string;
  totalCalls: number;
  answered: number;
  missed: number;
  avgDuration: number;
}

interface TelesaleReportRow {
  agentName: string;
  totalLeads: number;
  contacted: number;
  qualified: number;
  won: number;
  conversionRate: number;
}

interface CollectionReportRow {
  agentName: string;
  totalCases: number;
  contacted: number;
  promiseToPay: number;
  collected: number;
  collectionRate: number;
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('calls');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const params = { ...(dateFrom && { dateFrom }), ...(dateTo && { dateTo }) };

  const { data: callReport, isLoading: loadingCalls } = useQuery({
    queryKey: ['report-calls', params],
    queryFn: () => api.get<{ data: CallReportRow[] }>('/reports/calls', { params }).then((r) => r.data.data),
    enabled: activeTab === 'calls',
  });

  const { data: telesaleReport, isLoading: loadingTelesale } = useQuery({
    queryKey: ['report-telesale', params],
    queryFn: () => api.get<{ data: TelesaleReportRow[] }>('/reports/telesale', { params }).then((r) => r.data.data),
    enabled: activeTab === 'telesale',
  });

  const { data: collectionReport, isLoading: loadingCollection } = useQuery({
    queryKey: ['report-collection', params],
    queryFn: () => api.get<{ data: CollectionReportRow[] }>('/reports/collection', { params }).then((r) => r.data.data),
    enabled: activeTab === 'collection',
  });

  const dateFilter = (
    <div className="flex items-end gap-3 mb-4">
      <div className="space-y-1">
        <Label className="text-xs">Từ ngày</Label>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Đến ngày</Label>
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{VI.report.title}</h1>

      {dateFilter}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="calls">{VI.report.callReport}</TabsTrigger>
          <TabsTrigger value="telesale">{VI.report.telesaleReport}</TabsTrigger>
          <TabsTrigger value="collection">{VI.report.collectionReport}</TabsTrigger>
        </TabsList>

        <TabsContent value="calls" className="mt-4">
          <Card>
            <CardHeader><CardTitle>{VI.report.callReport}</CardTitle></CardHeader>
            <CardContent>
              {loadingCalls ? <Skeleton className="h-48 w-full" /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{VI.callLog.agent}</TableHead>
                      <TableHead>Tổng</TableHead>
                      <TableHead>{VI.dashboard.answered}</TableHead>
                      <TableHead>{VI.dashboard.missed}</TableHead>
                      <TableHead>{VI.dashboard.avgDuration}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {callReport?.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{row.agentName}</TableCell>
                        <TableCell>{row.totalCalls}</TableCell>
                        <TableCell>{row.answered}</TableCell>
                        <TableCell>{row.missed}</TableCell>
                        <TableCell>{formatDuration(row.avgDuration)}</TableCell>
                      </TableRow>
                    ))}
                    {(!callReport || callReport.length === 0) && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground h-16">{VI.actions.noData}</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="telesale" className="mt-4">
          <Card>
            <CardHeader><CardTitle>{VI.report.telesaleReport}</CardTitle></CardHeader>
            <CardContent>
              {loadingTelesale ? <Skeleton className="h-48 w-full" /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{VI.callLog.agent}</TableHead>
                      <TableHead>Tổng lead</TableHead>
                      <TableHead>Đã liên hệ</TableHead>
                      <TableHead>Đạt ĐK</TableHead>
                      <TableHead>Thành công</TableHead>
                      <TableHead>Tỷ lệ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {telesaleReport?.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{row.agentName}</TableCell>
                        <TableCell>{row.totalLeads}</TableCell>
                        <TableCell>{row.contacted}</TableCell>
                        <TableCell>{row.qualified}</TableCell>
                        <TableCell>{row.won}</TableCell>
                        <TableCell>{formatPercent(row.conversionRate)}</TableCell>
                      </TableRow>
                    ))}
                    {(!telesaleReport || telesaleReport.length === 0) && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground h-16">{VI.actions.noData}</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="collection" className="mt-4">
          <Card>
            <CardHeader><CardTitle>{VI.report.collectionReport}</CardTitle></CardHeader>
            <CardContent>
              {loadingCollection ? <Skeleton className="h-48 w-full" /> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{VI.callLog.agent}</TableHead>
                      <TableHead>Tổng hồ sơ</TableHead>
                      <TableHead>Đã liên hệ</TableHead>
                      <TableHead>Cam kết trả</TableHead>
                      <TableHead>Đã thu</TableHead>
                      <TableHead>Tỷ lệ thu</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {collectionReport?.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{row.agentName}</TableCell>
                        <TableCell>{row.totalCases}</TableCell>
                        <TableCell>{row.contacted}</TableCell>
                        <TableCell>{row.promiseToPay}</TableCell>
                        <TableCell>{row.collected}</TableCell>
                        <TableCell>{formatPercent(row.collectionRate)}</TableCell>
                      </TableRow>
                    ))}
                    {(!collectionReport || collectionReport.length === 0) && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground h-16">{VI.actions.noData}</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
