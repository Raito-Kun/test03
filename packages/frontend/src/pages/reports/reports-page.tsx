/** Main reports page — mockup-aligned: KPI row + chart section + tabbed detail */
import { useState, useCallback } from 'react';
import { TrendingUp, TrendingDown, PhoneMissed, DollarSign, Download } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ReportFilters, type FilterState } from './report-filters';
import { ReportSummaryTab } from './report-summary-tab';
import { ReportDetailTab } from './report-detail-tab';
import { ReportChartsTab } from './report-charts-tab';
import { ReportTicketsTab } from './report-tickets-tab';
import { SectionHeader } from '@/components/ops/section-header';
import { exportCsv } from './report-export-button';
import api from '@/services/api-client';

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const DEFAULT_FILTERS: FilterState = {
  dateFrom: firstOfMonth(),
  dateTo: today(),
  userId: '',
  teamId: '',
};

interface SummaryKpi {
  totalCalls: number;
  answered: number;
  missed: number;
  answerRate: number;
}

interface AgentRow {
  agentId: string;
  agentName: string;
  totalCalls: number;
  answered: number;
  missed: number;
  cancelled?: number;
  answerRate: number;
}

interface CallsByDayItem { date: string; total: number; answered: number; missed: number }
interface CallsByHourItem { hour: number; total: number; answered: number; missed: number }
interface ChartsData {
  callsByDay: CallsByDayItem[];
  callsByHour?: CallsByHourItem[];
  agentComparison: { agentName: string; answered: number; missed: number }[];
  weeklyTrend: unknown[];
  resultDistribution: { hangupCause: string; count: number }[];
}

// Emerald palette: emerald-500, emerald-300, slate-400, slate-300
const PIE_COLORS = ['#10B981', '#6ee7b7', '#9ca3af', '#d1d5db'];

// Vi labels cho hangup cause (sync với call-log-list — không re-export để giữ DRY thấp)
const HANGUP_CAUSE_VI: Record<string, string> = {
  NORMAL_CLEARING: 'Thành công',
  ORIGINATOR_CANCEL: 'Hủy',
  NO_ANSWER: 'Không trả lời',
  USER_BUSY: 'Máy bận',
  CALL_REJECTED: 'Từ chối',
  UNALLOCATED_NUMBER: 'Số không tồn tại',
  NO_ROUTE_DESTINATION: 'Không tìm thấy đích',
  RECOVERY_ON_TIMER_EXPIRE: 'Hết thời gian',
  LOSE_RACE: 'Cuộc gọi bị chiếm',
  SUBSCRIBER_ABSENT: 'Thuê bao không liên lạc',
  NORMAL_TEMPORARY_FAILURE: 'Lỗi tạm thời',
  DESTINATION_OUT_OF_ORDER: 'Đích không hoạt động',
  INVALID_NUMBER_FORMAT: 'Sai định dạng',
  FACILITY_REJECTED: 'Dịch vụ từ chối',
  EXCHANGE_ROUTING_ERROR: 'Lỗi định tuyến',
  NORMAL_UNSPECIFIED: 'Bình thường',
  UNWANTED: 'Không mong muốn',
  UNKNOWN: 'Không xác định',
};

/** Format a short date range label */
function fmtDateRange(from: string, to: string): string {
  function fmt(d: string) {
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  }
  return `${fmt(from)} — ${fmt(to)}`;
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('summary');
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [committed, setCommitted] = useState<FilterState | null>(null);
  const [searchVersion, setSearchVersion] = useState(0);

  const handleSearch = useCallback(() => {
    setCommitted({ ...filters });
    setSearchVersion((v) => v + 1);
  }, [filters]);

  const searched = committed !== null;
  const queryKey = ['reports', committed, searchVersion, activeTab];

  const effectiveFilters = committed ?? filters;
  const kpiParams = {
    start_date: effectiveFilters.dateFrom,
    end_date: effectiveFilters.dateTo,
    ...(effectiveFilters.userId && { user_id: effectiveFilters.userId }),
    ...(effectiveFilters.teamId && { team_id: effectiveFilters.teamId }),
  };

  /* KPI totals — derived from agent summary endpoint */
  const { data: agentRows, isFetching: loadingKpi } = useQuery<AgentRow[]>({
    queryKey: ['reports-kpi', committed, searchVersion],
    queryFn: () =>
      api
        .get<{ data: AgentRow[] }>('/reports/calls/summary', { params: kpiParams })
        .then((r) => r.data.data),
    enabled: searched,
  });

  /* Previous-period KPI cho badge "+X%" — query window cùng độ dài liền kề trước.
     Ví dụ kỳ này 01/05→04/05 (4 ngày) → kỳ trước 27/04→30/04. */
  const prevPeriodParams = (() => {
    const from = new Date(effectiveFilters.dateFrom);
    const to = new Date(effectiveFilters.dateTo);
    const lenDays = Math.floor((to.getTime() - from.getTime()) / 86400000) + 1;
    const prevTo = new Date(from);
    prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(prevTo);
    prevFrom.setDate(prevFrom.getDate() - (lenDays - 1));
    return {
      start_date: prevFrom.toISOString().slice(0, 10),
      end_date: prevTo.toISOString().slice(0, 10),
      ...(effectiveFilters.userId && { user_id: effectiveFilters.userId }),
      ...(effectiveFilters.teamId && { team_id: effectiveFilters.teamId }),
    };
  })();
  const { data: prevAgentRows } = useQuery<AgentRow[]>({
    queryKey: ['reports-kpi-prev', committed, searchVersion],
    queryFn: () =>
      api
        .get<{ data: AgentRow[] }>('/reports/calls/summary', { params: prevPeriodParams })
        .then((r) => r.data.data),
    enabled: searched,
  });

  /* Charts data for "Cuộc gọi theo giờ" bar + disposition donut */
  const { data: chartsData, isFetching: loadingCharts } = useQuery<ChartsData>({
    queryKey: ['reports-charts-overview', committed, searchVersion],
    queryFn: () =>
      api
        .get<{ data: ChartsData }>('/reports/calls/charts', { params: kpiParams })
        .then((r) => r.data.data),
    enabled: searched,
  });

  /* Derive KPI numbers — backend splits "missed" into missed+cancelled, but the
     KPI strip + dashboard show a single Nhỡ count. Convention: any non-answered
     call is "Nhỡ". Sum both buckets so the Nhỡ KPI matches Dashboard + chart. */
  const kpi: SummaryKpi = agentRows
    ? agentRows.reduce(
        (acc, r) => ({
          totalCalls: acc.totalCalls + r.totalCalls,
          answered: acc.answered + r.answered,
          missed: acc.missed + r.missed + (r.cancelled ?? 0),
          answerRate: 0, // computed below
        }),
        { totalCalls: 0, answered: 0, missed: 0, answerRate: 0 },
      )
    : { totalCalls: 0, answered: 0, missed: 0, answerRate: 0 };
  kpi.answerRate = kpi.totalCalls > 0 ? kpi.answered / kpi.totalCalls : 0;

  /* % thay đổi tổng cuộc gọi so với kỳ trước (null khi chưa có data prev) */
  const prevTotal = (prevAgentRows ?? []).reduce((s, r) => s + r.totalCalls, 0);
  const totalDeltaPct: number | null =
    prevAgentRows == null
      ? null
      : prevTotal > 0
      ? Math.round(((kpi.totalCalls - prevTotal) / prevTotal) * 100)
      : kpi.totalCalls > 0
      ? 100
      : 0;

  /* Top agents sorted by total calls */
  const topAgents = (agentRows ?? [])
    .slice()
    .sort((a, b) => b.totalCalls - a.totalCalls)
    .slice(0, 10);

  /* Bar chart "Cuộc gọi theo giờ" — backend trả 24 bucket (hour 0..23). Always show
     24 cột giúp chart luôn có sóng kể cả khi range chỉ vài ngày. */
  const callsByHourData = chartsData?.callsByHour ?? [];
  const formatHourTick = (h: number) => `${String(h).padStart(2, '0')}:00`;

  /* Disposition donut */
  const dispositionData = (chartsData?.resultDistribution ?? []).slice(0, 4);

  function handleExcelExport() {
    if (!agentRows?.length) return;
    exportCsv(
      agentRows.map((r) => ({
        ...r,
        answerRate: `${(r.answerRate * 100).toFixed(1)}%`,
      })) as Record<string, unknown>[],
      [
        { key: 'agentName', label: 'Nhân viên' },
        { key: 'totalCalls', label: 'Tổng cuộc gọi' },
        { key: 'answered', label: 'Đã nghe' },
        { key: 'missed', label: 'Nhỡ' },
        { key: 'answerRate', label: 'Tỷ lệ nghe %' },
      ],
      'bao-cao-tong-quan',
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Page title ── */}
      <SectionHeader label="Báo cáo" />

      {/* ── Top utility row: date range + filters + export ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          {/* Date range pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-card border border-dashed border-border rounded-lg text-sm font-mono">
            <span className="text-muted-foreground text-xs">📅</span>
            <span className="text-xs font-medium">
              {fmtDateRange(filters.dateFrom, filters.dateTo)}
            </span>
          </div>
          <ReportFilters
            filters={filters}
            onChange={setFilters}
            onSearch={handleSearch}
            loading={loadingKpi}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-dashed"
          onClick={handleExcelExport}
          disabled={!agentRows?.length}
        >
          <Download className="h-4 w-4" />
          Xuất Excel
        </Button>
      </div>

      {/* ── Segment tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="summary">Tổng quan</TabsTrigger>
          <TabsTrigger value="detail">Chi tiết</TabsTrigger>
          <TabsTrigger value="charts">Biểu đồ</TabsTrigger>
          <TabsTrigger value="tickets">Phiếu ghi</TabsTrigger>
        </TabsList>

        {/* ── Tổng quan tab — KPI cards + charts overview + agent list ── */}
        <TabsContent value="summary" className="mt-5 space-y-5">
          {!searched ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              Nhấn Tìm kiếm để xem báo cáo
            </p>
          ) : (
            <>
              {/* KPI cards row */}
              {loadingKpi ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-28 w-full" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* Tổng cuộc gọi — badge +X% so với kỳ trước (cùng độ dài) */}
                  <div className="bg-card p-5 rounded-xl border border-dashed border-border shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-mono text-muted-foreground">
                        Tổng cuộc gọi
                      </span>
                      {totalDeltaPct == null ? (
                        <span className="text-[10px] text-muted-foreground opacity-60 font-mono">vs kỳ trước</span>
                      ) : (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            totalDeltaPct >= 0
                              ? 'bg-green-100 text-green-700'
                              : 'bg-destructive/10 text-destructive'
                          }`}
                        >
                          {totalDeltaPct >= 0 ? '+' : ''}{totalDeltaPct}%
                        </span>
                      )}
                    </div>
                    <div className="text-2xl font-mono font-bold text-foreground">
                      {kpi.totalCalls.toLocaleString('vi-VN')}
                    </div>
                    <div className="mt-3 h-1 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{
                          width:
                            kpi.totalCalls > 0
                              ? `${Math.min((kpi.answered / kpi.totalCalls) * 100, 100)}%`
                              : '0%',
                        }}
                      />
                    </div>
                  </div>

                  {/* Tỷ lệ trả lời */}
                  <div className="bg-card p-5 rounded-xl border border-dashed border-border shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-mono text-muted-foreground">
                        Tỷ lệ trả lời
                      </span>
                      <TrendingUp className="h-4 w-4 text-primary" />
                    </div>
                    <div className="text-2xl font-mono font-bold text-foreground">
                      {(kpi.answerRate * 100).toFixed(1)}%
                    </div>
                    <div className="mt-3 h-1 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${Math.min(kpi.answerRate * 100, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Cuộc gọi nhỡ */}
                  <div className="bg-card p-5 rounded-xl border border-dashed border-border shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-mono text-muted-foreground">
                        Cuộc gọi nhỡ
                      </span>
                      <span className="text-[10px] bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-bold">
                        Cảnh báo
                      </span>
                    </div>
                    <div className="text-2xl font-mono font-bold text-foreground">
                      {kpi.missed.toLocaleString('vi-VN')}
                    </div>
                    <div className="mt-3 h-1 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-destructive rounded-full"
                        style={{
                          width:
                            kpi.totalCalls > 0
                              ? `${Math.min((kpi.missed / kpi.totalCalls) * 100, 100)}%`
                              : '0%',
                        }}
                      />
                    </div>
                  </div>

                  {/* Cuộc gọi đã nghe — tag "Hôm nay" theo style mockup */}
                  <div className="bg-card p-5 rounded-xl border border-dashed border-border shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-mono text-muted-foreground">
                        Cuộc gọi đã nghe
                      </span>
                      <span className="text-[10px] text-muted-foreground opacity-50 font-mono">
                        {effectiveFilters.dateFrom === effectiveFilters.dateTo ? 'Hôm nay' : 'Trong kỳ'}
                      </span>
                    </div>
                    <div className="text-2xl font-mono font-bold text-foreground">
                      {kpi.answered.toLocaleString('vi-VN')}
                    </div>
                    <div className="mt-3 h-1 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{
                          width:
                            kpi.totalCalls > 0
                              ? `${Math.min((kpi.answered / kpi.totalCalls) * 100, 100)}%`
                              : '0%',
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Cuộc gọi theo giờ — 24 bucket hour-of-day, luôn full sóng */}
              <div className="bg-card p-6 rounded-xl border border-dashed border-border shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-sm font-bold text-foreground">Cuộc gọi theo giờ</h3>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-primary" />
                      <span className="text-[10px] font-mono text-muted-foreground">Tổng</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-destructive/70" />
                      <span className="text-[10px] font-mono text-muted-foreground">Nhỡ</span>
                    </div>
                  </div>
                </div>
                {loadingCharts ? (
                  <Skeleton className="h-40 w-full" />
                ) : callsByHourData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart
                      data={callsByHourData}
                      margin={{ top: 0, right: 0, bottom: 0, left: -20 }}
                      barCategoryGap="15%"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis
                        dataKey="hour"
                        tick={{ fontSize: 10, fontFamily: 'Space Grotesk' }}
                        tickFormatter={(h: number) => formatHourTick(h)}
                        interval={2}
                      />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip
                        labelFormatter={(h) => `${formatHourTick(Number(h))} → ${formatHourTick(Number(h) + 1)}`}
                      />
                      <Bar dataKey="total" name="Tổng" fill="var(--primary)" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="missed" name="Nhỡ" fill="var(--destructive)" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-40 flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">Không có dữ liệu</p>
                  </div>
                )}
              </div>

              {/* Bottom row: Top 10 Agents + Disposition donut */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Top 10 Agents */}
                <div className="bg-card p-6 rounded-xl border border-dashed border-border shadow-sm">
                  <h3 className="text-sm font-bold text-foreground mb-4">Top 10 Agents</h3>
                  {loadingKpi ? (
                    <Skeleton className="h-40 w-full" />
                  ) : topAgents.length > 0 ? (
                    <div className="space-y-3">
                      {topAgents.map((agent, idx) => (
                        <div
                          key={agent.agentId}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded bg-accent flex items-center justify-center text-[10px] font-bold text-primary font-mono">
                              {String(idx + 1).padStart(2, '0')}
                            </div>
                            <span className="text-xs text-foreground">{agent.agentName}</span>
                          </div>
                          <span className="text-xs font-mono font-bold text-foreground">
                            {agent.totalCalls}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Không có dữ liệu
                    </p>
                  )}
                </div>

                {/* Disposition donut — Vi labels + center % cho top disposition */}
                <div className="bg-card p-6 rounded-xl border border-dashed border-border shadow-sm flex flex-col">
                  <h3 className="text-sm font-bold text-foreground mb-4">
                    Phân loại Disposition
                  </h3>
                  {loadingCharts ? (
                    <Skeleton className="h-40 w-full" />
                  ) : dispositionData.length > 0 ? (
                    (() => {
                      const totalDisp = dispositionData.reduce((s, d) => s + d.count, 0);
                      const topShare = totalDisp > 0
                        ? Math.round((dispositionData[0].count / totalDisp) * 100)
                        : 0;
                      return (
                        <div className="flex flex-col items-center flex-1">
                          <div className="relative w-full">
                            <ResponsiveContainer width="100%" height={140}>
                              <PieChart>
                                <Pie
                                  data={dispositionData}
                                  dataKey="count"
                                  nameKey="hangupCause"
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={42}
                                  outerRadius={62}
                                >
                                  {dispositionData.map((_, i) => (
                                    <Cell
                                      key={i}
                                      fill={PIE_COLORS[i % PIE_COLORS.length]}
                                    />
                                  ))}
                                </Pie>
                                <Tooltip
                                  formatter={(value, name) => [
                                    String(value ?? 0),
                                    HANGUP_CAUSE_VI[String(name ?? '')] ?? String(name ?? ''),
                                  ]}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                            {/* Center % overlay (như mockup show 76%) */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                              <span className="text-xl font-bold font-mono text-foreground tabular-nums">
                                {topShare}%
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 w-full mt-2">
                            {dispositionData.map((d, i) => (
                              <div key={i} className="flex items-center gap-1.5">
                                <span
                                  className="w-1.5 h-1.5 rounded-full shrink-0"
                                  style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                                />
                                <span className="text-[10px] text-muted-foreground truncate">
                                  {HANGUP_CAUSE_VI[d.hangupCause] ?? d.hangupCause}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="flex-1 flex items-center justify-center">
                      <p className="text-sm text-muted-foreground">Không có dữ liệu</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Full agent summary table below */}
              <ReportSummaryTab
                filters={committed ?? filters}
                searched={searched}
                queryKey={queryKey}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="detail" className="mt-4">
          <ReportDetailTab
            filters={committed ?? filters}
            searched={searched}
            queryKey={queryKey}
          />
        </TabsContent>

        <TabsContent value="charts" className="mt-4">
          <ReportChartsTab
            filters={committed ?? filters}
            searched={searched}
            queryKey={queryKey}
          />
        </TabsContent>

        <TabsContent value="tickets" className="mt-4">
          <ReportTicketsTab
            filters={committed ?? filters}
            searched={searched}
            queryKey={queryKey}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
