import { useAgentStatusStore } from '@/stores/agent-status-store';
import { VI } from '@/lib/vi-text';
import api from '@/services/api-client';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import type { AgentStatus } from '@shared/constants/enums';

const statusColors: Record<string, string> = {
  offline: 'bg-muted-foreground/60',
  ready: 'bg-green-500',
  break: 'bg-yellow-500',
  ringing: 'bg-blue-500 animate-pulse',
  on_call: 'bg-blue-600',
  hold: 'bg-orange-500',
  wrap_up: 'bg-purple-500',
  transfer: 'bg-cyan-500',
};

// Only these statuses can be manually set
const manualStatuses: AgentStatus[] = ['ready', 'break', 'offline'];

export function AgentStatusSelector() {
  const myStatus = useAgentStatusStore((s) => s.myStatus);
  const setMyStatus = useAgentStatusStore((s) => s.setMyStatus);

  async function handleChange(status: AgentStatus) {
    try {
      await api.put('/agents/status', { status });
      setMyStatus(status);
    } catch {
      // silently fail — toast could be added
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <span className={`h-2 w-2 rounded-full ${statusColors[myStatus] || 'bg-muted-foreground/60'}`} />
          {VI.agentStatus[myStatus]}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {manualStatuses.map((status) => (
          <DropdownMenuItem key={status} onClick={() => handleChange(status)}>
            <span className={`mr-2 h-2 w-2 rounded-full ${statusColors[status]}`} />
            {VI.agentStatus[status]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
