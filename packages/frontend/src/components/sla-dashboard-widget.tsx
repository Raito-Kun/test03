import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle, XCircle, Clock, Timer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/services/api-client';

interface SlaByPriority {
  priority: string;
  total: number;
  compliant: number;
  breached: number;
  compliancePercent: number;
}

interface SlaData {
  overallCompliancePercent: number;
  approachingBreach: number;
  breached: number;
  avgFirstResponseMinutes: number;
  avgResolutionMinutes: number;
  byPriority?: SlaByPriority[];
}

interface SlaDashboardWidgetProps {
  className?: string;
}

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'Khẩn cấp',
  high: 'Cao',
  medium: 'Trung bình',
  low: 'Thấp',
};

const PRIORITY_COLOR: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-400',
  medium: 'bg-amber-400',
  low: 'bg-blue-400',
};

function formatMinutes(minutes: number): string {
  if (!minutes || minutes === 0) return '—';
  if (minutes < 60) return `${Math.round(minutes)}p`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}g${m}p` : `${h}g`;
}

function complianceColor(pct: number): string {
  if (pct >= 90) return 'text-emerald-600';
  if (pct >= 70) return 'text-amber-500';
  return 'text-red-500';
}

function complianceBg(pct: number): string {
  if (pct >= 90) return 'bg-emerald-500';
  if (pct >= 70) return 'bg-amber-400';
  return 'bg-red-500';
}

export function SlaDashboardWidget({ className }: SlaDashboardWidgetProps) {
  const { data, isLoading, isError } = useQuery<SlaData>({
    queryKey: ['sla-dashboard'],
    queryFn: async () => {
      const { data: resp } = await api.get('/reports/sla');
      return (resp.data ?? resp) as SlaData;
    },
    refetchInterval: 60_000,
  });

  const pct = data?.overallCompliancePercent ?? 0;

  return (
    <Card className={`border shadow-sm bg-white ${className ?? ''}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
          Tuân thủ SLA
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : isError ? (
          <p className="text-sm text-red-500 text-center py-2">Không thể tải dữ liệu SLA</p>
        ) : (
          <>
            {/* Overall compliance */}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Tổng tuân thủ</span>
                  <span className={`text-lg font-bold ${complianceColor(pct)}`}>{pct}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${complianceBg(pct)}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 rounded bg-amber-50 px-2.5 py-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <div>
                  <p className="text-xs text-amber-700">Sắp vi phạm</p>
                  <p className="text-base font-bold text-amber-800">{data?.approachingBreach ?? 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded bg-red-50 px-2.5 py-2">
                <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                <div>
                  <p className="text-xs text-red-700">Đã vi phạm</p>
                  <p className="text-base font-bold text-red-800">{data?.breached ?? 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded bg-muted px-2.5 py-2">
                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Thời gian phản hồi TB</p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatMinutes(data?.avgFirstResponseMinutes ?? 0)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded bg-muted px-2.5 py-2">
                <Timer className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Thời gian xử lý TB</p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatMinutes(data?.avgResolutionMinutes ?? 0)}
                  </p>
                </div>
              </div>
            </div>

            {/* By priority bars */}
            {data?.byPriority && data.byPriority.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Theo mức độ ưu tiên</p>
                {data.byPriority.map((row) => (
                  <div key={row.priority} className="flex items-center gap-2">
                    <div className="w-20 shrink-0 flex items-center gap-1.5">
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${PRIORITY_COLOR[row.priority] ?? 'bg-muted-foreground/60'}`}
                      />
                      <span className="text-xs text-muted-foreground truncate">
                        {PRIORITY_LABELS[row.priority] ?? row.priority}
                      </span>
                    </div>
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${complianceBg(row.compliancePercent)}`}
                        style={{ width: `${Math.min(100, row.compliancePercent)}%` }}
                      />
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 shrink-0 ${complianceColor(row.compliancePercent)} border-current`}
                    >
                      {row.compliancePercent}%
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
