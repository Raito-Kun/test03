import { useState, useEffect } from 'react';
import { Lightbulb, Loader2 } from 'lucide-react';
import * as aiService from '@/services/ai-service';

interface CallCoachingCardProps {
  callContext: string;
}

export function CallCoachingCard({ callContext }: CallCoachingCardProps) {
  const [suggestion, setSuggestion] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!callContext) return;
    setLoading(true);
    aiService.getCoaching(callContext)
      .then(setSuggestion)
      .catch(() => setSuggestion(''))
      .finally(() => setLoading(false));
  }, [callContext]);

  if (!suggestion && !loading) return null;

  return (
    <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm">
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-amber-500 mt-0.5 shrink-0" />
      ) : (
        <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
      )}
      <p className="text-amber-800">{loading ? 'Đang phân tích...' : suggestion}</p>
    </div>
  );
}
