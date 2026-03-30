import { useQuery } from '@tanstack/react-query';
import { X, FileText } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import api from '@/services/api-client';
import { useAgentStatusStore } from '@/stores/agent-status-store';

interface ScriptData {
  name: string;
  content: string;
  type: 'campaign' | 'product' | 'default';
}

const TYPE_LABELS: Record<string, string> = {
  campaign: 'Chiến dịch',
  product: 'Sản phẩm',
  default: 'Mặc định',
};

/**
 * Floating script panel — shows during active calls.
 * Renders as a sibling component in app layout, NOT inside call-bar.
 * Reads agent status from Zustand store to detect active call.
 */
export function CallScriptPanel() {
  const [dismissed, setDismissed] = useState(false);
  const agentStatus = useAgentStatusStore((s) => s.myStatus);
  const isOnCall = agentStatus === 'on_call' || agentStatus === 'ringing';

  const { data: script } = useQuery({
    queryKey: ['active-call-script'],
    queryFn: async () => {
      const { data: resp } = await api.get('/scripts/active-call');
      return resp.data as ScriptData | null;
    },
    enabled: isOnCall && !dismissed,
    refetchInterval: isOnCall ? 10000 : false, // Refresh every 10s while on call
  });

  // Reset dismissed state when call ends
  if (!isOnCall && dismissed) {
    setDismissed(false);
  }

  if (!isOnCall || dismissed || !script) return null;

  return (
    <div className="fixed right-0 top-16 bottom-0 w-96 bg-background border-l shadow-lg z-40 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">{script.name}</span>
          <Badge variant="secondary" className="text-xs">
            {TYPE_LABELS[script.type] || script.type}
          </Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDismissed(true)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Script content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div
          className="prose prose-sm max-w-none dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: formatScript(script.content) }}
        />
      </div>
    </div>
  );
}

/** Convert plain text script to HTML with basic formatting */
function formatScript(content: string): string {
  return content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>');
}
