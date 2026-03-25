import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import * as aiService from '@/services/ai-service';

const SEVERITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-blue-100 text-blue-700 border-blue-200',
};

export function AnomalyAlertWidget() {
  const { data: anomalies, isLoading } = useQuery({
    queryKey: ['ai-anomalies'],
    queryFn: () => aiService.getAnomalies(),
    refetchInterval: 5 * 60 * 1000,
  });

  if (isLoading || !anomalies?.length) return null;

  return (
    <Card className="border-0 shadow-sm bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4 text-violet-500" />
          AI Cảnh báo bất thường
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {anomalies.map((a, i) => (
          <div key={i} className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-700">{a.type}</span>
                <Badge variant="outline" className={`text-[10px] px-1 ${SEVERITY_COLORS[a.severity] || ''}`}>
                  {a.severity}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{a.description}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
