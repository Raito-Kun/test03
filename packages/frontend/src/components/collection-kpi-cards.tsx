import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Minus, Phone, DollarSign, RefreshCw, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/services/api-client';

interface DashboardStats {
  calls: { totalToday: number; answerRatePercent: number; avgDuration?: number };
  debtCases: {
    ptpRatePercent?: number;
    recoveryRatePercent?: number;
  };
  wrapUp?: { avgDurationSeconds?: number };
}

interface CollectionKpiCardsProps {
  dateRange?: { from: string; to: string };
}

function getPctColor(value: number, thresholdGood: number, thresholdOk: number): string {
  if (value >= thresholdGood) return 'text-emerald-600';
  if (value >= thresholdOk) return 'text-amber-500';
  return 'text-red-500';
}

function TrendIcon({ value, threshold }: { value: number; threshold: number }) {
  if (value >= threshold) return <TrendingUp className="h-4 w-4 text-emerald-500" />;
  if (value >= threshold * 0.6) return <Minus className="h-4 w-4 text-amber-400" />;
  return <TrendingDown className="h-4 w-4 text-red-400" />;
}

function formatSeconds(seconds?: number): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${s}s`;
}

export function CollectionKpiCards({ dateRange }: CollectionKpiCardsProps) {
  const { data, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats-kpi', dateRange],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (dateRange?.from) params.from = dateRange.from;
      if (dateRange?.to) params.to = dateRange.to;
      const { data: resp } = await api.get('/dashboard/stats', { params });
      return resp.data ?? resp;
    },
    refetchInterval: 60_000,
  });

  const ptpRate = data?.debtCases?.ptpRatePercent ?? 0;
  const recoveryRate = data?.debtCases?.recoveryRatePercent ?? 0;
  const wrapUpAvg = data?.wrapUp?.avgDurationSeconds;
  const callsToday = data?.calls?.totalToday ?? 0;

  const cards = [
    {
      label: 'Tỷ lệ PTP',
      value: `${ptpRate}%`,
      icon: DollarSign,
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
      valueColor: getPctColor(ptpRate, 50, 30),
      trend: <TrendIcon value={ptpRate} threshold={50} />,
      sub: 'Promise to Pay',
    },
    {
      label: 'Tỷ lệ thu hồi',
      value: `${recoveryRate}%`,
      icon: RefreshCw,
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      valueColor: getPctColor(recoveryRate, 50, 30),
      trend: <TrendIcon value={recoveryRate} threshold={50} />,
      sub: 'Recovery Rate',
    },
    {
      label: 'Thời gian xử lý TB',
      value: formatSeconds(wrapUpAvg),
      icon: Clock,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      valueColor: 'text-foreground',
      trend: null,
      sub: 'Avg Wrap-up Time',
    },
    {
      label: 'Cuộc gọi hôm nay',
      value: String(callsToday),
      icon: Phone,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      valueColor: 'text-foreground',
      trend: null,
      sub: 'Calls Today',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map(({ label, value, icon: Icon, iconBg, iconColor, valueColor, trend, sub }) => (
        <Card key={label} className="border shadow-sm bg-card">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${iconBg}`}>
                <Icon className={`h-5 w-5 ${iconColor}`} />
              </div>
              {trend && <div className="mt-0.5">{trend}</div>}
            </div>
            <div className="mt-3">
              {isLoading ? (
                <Skeleton className="h-7 w-16 mb-1" />
              ) : (
                <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
              )}
              <p className="text-xs font-medium text-muted-foreground mt-0.5">{label}</p>
              <p className="text-[10px] text-muted-foreground/70 font-mono uppercase tracking-wider">{sub}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
