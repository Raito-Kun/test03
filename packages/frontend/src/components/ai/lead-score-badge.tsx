import { useQuery } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import * as aiService from '@/services/ai-service';

interface LeadScoreBadgeProps {
  leadData: string;
  leadId: string;
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'from-emerald-500 to-emerald-600';
  if (score >= 60) return 'from-blue-500 to-blue-600';
  if (score >= 40) return 'from-amber-500 to-amber-600';
  return 'from-slate-400 to-slate-500';
}

export function LeadScoreBadge({ leadData, leadId }: LeadScoreBadgeProps) {
  const { data } = useQuery({
    queryKey: ['ai-lead-score', leadId],
    queryFn: () => aiService.scoreLead(leadData),
    staleTime: 10 * 60 * 1000,
    enabled: !!leadData,
  });

  if (!data) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r ${getScoreColor(data.score)} px-2 py-0.5 text-xs font-bold text-white shadow-sm cursor-help`}>
          <Sparkles className="h-2.5 w-2.5" />
          {data.score}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="text-xs">{data.reason}</p>
      </TooltipContent>
    </Tooltip>
  );
}
