import { useQuery } from '@tanstack/react-query';
import { Sparkles, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import * as aiService from '@/services/ai-service';

interface CustomerSummaryCardProps {
  customerData: string;
  contactId: string;
}

export function CustomerSummaryCard({ customerData, contactId }: CustomerSummaryCardProps) {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['ai-summary', contactId],
    queryFn: () => aiService.summarizeCustomer(customerData),
    staleTime: 5 * 60 * 1000, // Cache for 5 min
    enabled: !!customerData,
  });

  return (
    <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50/50 to-violet-50/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4 text-violet-500" />
          AI Tóm tắt khách hàng
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            Đang phân tích...
          </div>
        ) : (
          <div className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
            {summary || 'Không có dữ liệu để phân tích.'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
