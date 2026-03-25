import { useState, useEffect } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import * as aiService from '@/services/ai-service';

interface DispositionSuggestionProps {
  callData: string;
  onSelect?: (disposition: string) => void;
}

export function DispositionSuggestion({ callData, onSelect }: DispositionSuggestionProps) {
  const [suggestion, setSuggestion] = useState<{ disposition: string; confidence: number; reason: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!callData) return;
    setLoading(true);
    aiService.suggestDisposition(callData)
      .then(setSuggestion)
      .catch(() => setSuggestion(null))
      .finally(() => setLoading(false));
  }, [callData]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Loader2 className="h-3 w-3 animate-spin" />
        AI đang phân tích...
      </div>
    );
  }

  if (!suggestion?.disposition) return null;

  return (
    <button
      onClick={() => onSelect?.(suggestion.disposition)}
      className="flex items-center gap-2 rounded-lg bg-violet-50 border border-violet-200 px-3 py-1.5 text-xs hover:bg-violet-100 transition-colors"
    >
      <Sparkles className="h-3 w-3 text-violet-500" />
      <span className="text-violet-700">AI gợi ý:</span>
      <Badge variant="outline" className="text-violet-600 border-violet-300">{suggestion.disposition}</Badge>
      <span className="text-violet-400">({Math.round(suggestion.confidence * 100)}%)</span>
    </button>
  );
}
