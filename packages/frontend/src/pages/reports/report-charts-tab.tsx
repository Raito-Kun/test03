/** Tab 3: Biểu đồ — 2x2 grid of recharts visualizations */
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/services/api-client';
import type { FilterState } from './report-filters';

interface CallsByDayItem { date: string; total: number; answered: number; missed: number }
interface AgentCompItem { agentName: string; answered: number; missed: number }
interface WeeklyTrendItem { week: string; total: number; answered: number }
interface ResultDistItem { hangupCause: string; count: number }

interface ChartsData {
  callsByDay: CallsByDayItem[];
  agentComparison: AgentCompItem[];
  weeklyTrend: WeeklyTrendItem[];
  resultDistribution: ResultDistItem[];
}

interface Props {
  filters: FilterState;
  searched: boolean;
  queryKey: unknown[];
}

const C = {
  indigo: '#6366f1',
  green: '#22c55e',
  red: '#ef4444',
  amber: '#f59e0b',
  cyan: '#06b6d4',
};
const PIE_COLORS = [C.indigo, C.green, C.red, C.amber, C.cyan, '#ec4899'];

const CHART_HEIGHT = 300;

export function ReportChartsTab({ filters, searched, queryKey }: Props) {
  const params = {
    start_date: filters.dateFrom,
    end_date: filters.dateTo,
    ...(filters.userId && { user_id: filters.userId }),
    ...(filters.teamId && { team_id: filters.teamId }),
  };

  const { data, isFetching } = useQuery<ChartsData>({
    queryKey: [...queryKey, 'charts'],
    queryFn: () => api.get<{ data: ChartsData }>('/reports/calls/charts', { params }).then((r) => r.data.data),
    enabled: searched,
  });

  if (!searched) {
    return <p className="text-muted-foreground text-sm py-8 text-center">Nhấn Tìm kiếm để xem báo cáo</p>;
  }

  if (isFetching) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-80 w-full" />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Chart 1: Calls by day */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Tổng cuộc gọi theo ngày</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <BarChart data={data?.callsByDay ?? []} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" name="Tổng" fill={C.indigo} />
              <Bar dataKey="answered" name="Đã nghe" fill={C.green} />
              <Bar dataKey="missed" name="Nhỡ" fill={C.red} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Chart 2: Agent comparison */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">So sánh nhân viên</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <BarChart data={data?.agentComparison ?? []} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="agentName" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="answered" name="Đã nghe" fill={C.green} />
              <Bar dataKey="missed" name="Nhỡ" fill={C.red} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Chart 3: Weekly trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Xu hướng cuộc gọi theo tuần</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <LineChart data={data?.weeklyTrend ?? []} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="total" name="Tổng" stroke={C.indigo} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="answered" name="Đã nghe" stroke={C.green} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Chart 4: Result distribution pie */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Tỷ lệ kết quả cuộc gọi</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <PieChart>
              <Pie
                data={data?.resultDistribution ?? []}
                dataKey="count"
                nameKey="hangupCause"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
              >
                {(data?.resultDistribution ?? []).map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
