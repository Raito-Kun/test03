import { useQuery } from '@tanstack/react-query';
import { Phone, PhoneIncoming, PhoneMissed, Clock, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { VI } from '@/lib/vi-text';
import api from '@/services/api-client';

interface OverviewData {
  totalCalls: number;
  answered: number;
  missed: number;
  avgDuration: number;
  activeCalls: number;
  leadsByStatus?: Record<string, number>;
  debtsByTier?: Record<string, number>;
}

interface AgentStatus {
  userId: string;
  fullName: string;
  status: string;
  changedAt: string;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    ready: 'bg-green-500',
    on_call: 'bg-blue-500',
    ringing: 'bg-yellow-500',
    break: 'bg-orange-500',
    wrap_up: 'bg-purple-500',
    offline: 'bg-gray-400',
    hold: 'bg-cyan-500',
    transfer: 'bg-pink-500',
  };
  return map[status] || 'bg-gray-400';
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}

const STAT_CARDS = [
  { key: 'totalCalls', label: VI.dashboard.totalCalls, icon: Phone, color: 'text-blue-500' },
  { key: 'answered', label: VI.dashboard.answered, icon: PhoneIncoming, color: 'text-green-500' },
  { key: 'missed', label: VI.dashboard.missed, icon: PhoneMissed, color: 'text-red-500' },
  { key: 'activeCalls', label: VI.dashboard.activeCalls, icon: Users, color: 'text-purple-500' },
] as const;

export default function DashboardPage() {
  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: () => api.get<{ data: OverviewData }>('/dashboard/overview').then((r) => r.data.data),
    refetchInterval: 30_000,
  });

  const { data: agents, isLoading: loadingAgents } = useQuery({
    queryKey: ['dashboard-agents'],
    queryFn: () => api.get<{ data: AgentStatus[] }>('/dashboard/agents').then((r) => r.data.data),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{VI.nav.dashboard}</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STAT_CARDS.map(({ key, label, icon: Icon, color }) => (
          <Card key={key}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className={`h-5 w-5 ${color}`} />
            </CardHeader>
            <CardContent>
              {loadingOverview ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-3xl font-bold">{overview?.[key] ?? 0}</p>
              )}
            </CardContent>
          </Card>
        ))}

        {/* Avg duration card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{VI.dashboard.avgDuration}</CardTitle>
            <Clock className="h-5 w-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            {loadingOverview ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-3xl font-bold">{formatDuration(overview?.avgDuration ?? 0)}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Agent status grid */}
        <Card>
          <CardHeader>
            <CardTitle>{VI.dashboard.agentGrid}</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingAgents ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {(agents ?? []).map((agent) => (
                  <div key={agent.userId} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <span className="font-medium text-sm">{agent.fullName}</span>
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${getStatusColor(agent.status)}`} />
                      <Badge variant="outline" className="text-xs">
                        {VI.agentStatus[agent.status as keyof typeof VI.agentStatus] || agent.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{timeAgo(agent.changedAt)}</span>
                    </div>
                  </div>
                ))}
                {agents?.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-4">{VI.actions.noData}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* Lead funnel summary */}
          <Card>
            <CardHeader>
              <CardTitle>{VI.dashboard.leadSummary}</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingOverview ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(overview?.leadsByStatus ?? {}).map(([status, count]) => (
                    <div key={status} className="rounded-md border p-2 text-center">
                      <p className="text-lg font-bold">{count}</p>
                      <p className="text-xs text-muted-foreground">
                        {VI.lead.statuses[status as keyof typeof VI.lead.statuses] || status}
                      </p>
                    </div>
                  ))}
                  {!overview?.leadsByStatus && (
                    <p className="col-span-3 text-center text-sm text-muted-foreground py-2">{VI.actions.noData}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Debt summary */}
          <Card>
            <CardHeader>
              <CardTitle>{VI.dashboard.debtSummary}</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingOverview ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(overview?.debtsByTier ?? {}).map(([tier, count]) => (
                    <div key={tier} className="rounded-md border p-2 text-center">
                      <p className="text-lg font-bold">{count}</p>
                      <p className="text-xs text-muted-foreground">
                        {VI.debt.tiers[tier as keyof typeof VI.debt.tiers] || tier}
                      </p>
                    </div>
                  ))}
                  {!overview?.debtsByTier && (
                    <p className="col-span-2 text-center text-sm text-muted-foreground py-2">{VI.actions.noData}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
