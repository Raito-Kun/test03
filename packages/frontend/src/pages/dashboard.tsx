import { useQuery } from '@tanstack/react-query';
import { Phone, PhoneIncoming, PhoneMissed, Clock, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { VI } from '@/lib/vi-text';
import { formatDuration } from '@/lib/format';
import api from '@/services/api-client';
import { AnomalyAlertWidget } from '@/components/ai/anomaly-alert-widget';

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

function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    ready: 'bg-emerald-500', on_call: 'bg-blue-500', ringing: 'bg-amber-500',
    break: 'bg-orange-500', wrap_up: 'bg-purple-500', offline: 'bg-slate-400',
    hold: 'bg-cyan-500', transfer: 'bg-pink-500',
  };
  return map[status] || 'bg-slate-400';
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}

const STAT_CARDS = [
  { key: 'totalCalls', label: VI.dashboard.totalCalls, icon: Phone, gradient: 'from-blue-500 to-blue-600', bg: 'bg-blue-50' },
  { key: 'answered', label: VI.dashboard.answered, icon: PhoneIncoming, gradient: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-50' },
  { key: 'missed', label: VI.dashboard.missed, icon: PhoneMissed, gradient: 'from-rose-500 to-rose-600', bg: 'bg-rose-50' },
  { key: 'activeCalls', label: VI.dashboard.activeCalls, icon: Users, gradient: 'from-violet-500 to-violet-600', bg: 'bg-violet-50' },
] as const;

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#64748b'];

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

  const leadChartData = Object.entries(overview?.leadsByStatus ?? {}).map(([status, count]) => ({
    name: VI.lead.statuses[status as keyof typeof VI.lead.statuses] || status,
    value: count,
  }));

  const debtChartData = Object.entries(overview?.debtsByTier ?? {}).map(([tier, count]) => ({
    name: VI.debt.tiers[tier as keyof typeof VI.debt.tiers] || tier,
    value: count,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">{VI.nav.dashboard}</h1>

      {/* Stat cards with glassmorphism */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {STAT_CARDS.map(({ key, label, icon: Icon, gradient, bg }) => (
          <Card key={key} className={`${bg} border-0 shadow-sm overflow-hidden relative`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
                  {loadingOverview ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <p className="text-3xl font-bold text-slate-900">{overview?.[key] ?? 0}</p>
                  )}
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-lg`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Avg duration */}
        <Card className="bg-amber-50 border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">{VI.dashboard.avgDuration}</p>
                {loadingOverview ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-3xl font-bold text-slate-900">{formatDuration(overview?.avgDuration ?? 0)}</p>
                )}
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg">
                <Clock className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Anomaly Alerts */}
      <AnomalyAlertWidget />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Agent status grid */}
        <Card className="lg:col-span-1 shadow-sm border-0 bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{VI.dashboard.agentGrid}</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingAgents ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {(agents ?? []).map((agent) => (
                  <div key={agent.userId} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 hover:bg-slate-100 transition-colors">
                    <span className="font-medium text-sm text-slate-700">{agent.fullName}</span>
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${getStatusColor(agent.status)} ring-2 ring-white`} />
                      <Badge variant="outline" className="text-[10px] px-1.5">
                        {VI.agentStatus[agent.status as keyof typeof VI.agentStatus] || agent.status}
                      </Badge>
                      <span className="text-[10px] text-slate-400">{timeAgo(agent.changedAt)}</span>
                    </div>
                  </div>
                ))}
                {agents?.length === 0 && (
                  <p className="text-center text-sm text-slate-400 py-4">{VI.actions.noData}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lead funnel chart */}
        <Card className="shadow-sm border-0 bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{VI.dashboard.leadSummary}</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingOverview ? (
              <Skeleton className="h-48 w-full" />
            ) : leadChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={leadChartData} cx="50%" cy="50%" outerRadius={70} innerRadius={40} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {leadChartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-sm text-slate-400 py-12">{VI.actions.noData}</p>
            )}
          </CardContent>
        </Card>

        {/* Debt tier chart */}
        <Card className="shadow-sm border-0 bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{VI.dashboard.debtSummary}</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingOverview ? (
              <Skeleton className="h-48 w-full" />
            ) : debtChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={debtChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RechartsTooltip />
                  <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-sm text-slate-400 py-12">{VI.actions.noData}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
