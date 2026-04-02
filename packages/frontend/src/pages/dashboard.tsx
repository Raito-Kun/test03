import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Phone, PhoneIncoming, PhoneMissed, Clock, Users } from 'lucide-react';
// Charts removed — using summary cards instead
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { VI } from '@/lib/vi-text';
import { formatDuration } from '@/lib/format';
import api from '@/services/api-client';
import { AnomalyAlertWidget } from '@/components/ai/anomaly-alert-widget';
import { ClickToCallButton } from '@/components/click-to-call-button';

/** Matches actual API response from GET /dashboard/overview */
interface OverviewData {
  calls: { totalToday: number; answeredToday: number; answerRatePercent: number; avgDuration?: number };
  agents: { total: number; onCall: number };
  leads: { newToday: number; wonToday?: number; closeRatePercent?: number };
  tickets: { open: number };
  debtCases: { active: number; ptpRatePercent?: number; recoveryRatePercent?: number; amountCollectedToday?: number; totalOutstanding?: number };
  wrapUp?: { avgDurationSeconds?: number };
}

interface AgentStatus {
  id: string;
  fullName: string;
  role: string;
  currentStatus: { status: string; updatedAt: string | null };
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

function getStatCards(o: OverviewData | undefined) {
  const missed = (o?.calls.totalToday ?? 0) - (o?.calls.answeredToday ?? 0);
  return [
    { label: VI.dashboard.totalCalls, value: o?.calls.totalToday ?? 0, icon: Phone, gradient: 'from-blue-500 to-blue-600', bg: 'bg-blue-50' },
    { label: VI.dashboard.answered, value: o?.calls.answeredToday ?? 0, icon: PhoneIncoming, gradient: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-50' },
    { label: VI.dashboard.missed, value: missed, icon: PhoneMissed, gradient: 'from-rose-500 to-rose-600', bg: 'bg-rose-50' },
    { label: VI.dashboard.activeCalls, value: o?.agents.onCall ?? 0, icon: Users, gradient: 'from-violet-500 to-violet-600', bg: 'bg-violet-50' },
  ];
}

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#64748b'];

function QuickDialWidget() {
  const [phone, setPhone] = useState('');
  return (
    <Card className="shadow-sm border-0 bg-white">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Phone className="h-4 w-4" /> Gọi nhanh (Eyebeam)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <Input
            type="tel"
            placeholder="Nhập số điện thoại..."
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^0-9+*#]/g, ''))}
            className="max-w-xs"
            onKeyDown={(e) => e.key === 'Enter' && phone.length >= 5 && document.getElementById('quick-dial-btn')?.click()}
          />
          <div id="quick-dial-btn">
            <ClickToCallButton phone={phone} contactName={phone} size="default" variant="default" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Nhấn Gọi để ring Eyebeam, sau khi nhấc máy sẽ kết nối đến số khách hàng qua tổng đài.
        </p>
      </CardContent>
    </Card>
  );
}

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

  const statCards = getStatCards(overview);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">{VI.nav.dashboard}</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {statCards.map(({ label, value, icon: Icon, gradient, bg }) => (
          <Card key={label} className={`${bg} border-0 shadow-sm overflow-hidden relative`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
                  {loadingOverview ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <p className="text-3xl font-bold text-slate-900">{value}</p>
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
                  <p className="text-3xl font-bold text-slate-900">
                    {overview?.calls.avgDuration ? formatDuration(overview.calls.avgDuration) : `${overview?.calls.answerRatePercent ?? 0}%`}
                  </p>
                )}
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg">
                <Clock className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="bg-sky-50 border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500 mb-1">Tỷ lệ liên hệ</p>
            {loadingOverview ? <Skeleton className="h-8 w-16" /> : (
              <p className="text-2xl font-bold text-slate-900">{overview?.calls.answerRatePercent ?? 0}%</p>
            )}
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500 mb-1">Tỷ lệ chốt đơn</p>
            {loadingOverview ? <Skeleton className="h-8 w-16" /> : (
              <p className="text-2xl font-bold text-slate-900">{overview?.leads.closeRatePercent ?? 0}%</p>
            )}
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500 mb-1">Tỷ lệ PTP</p>
            {loadingOverview ? <Skeleton className="h-8 w-16" /> : (
              <p className="text-2xl font-bold text-slate-900">{overview?.debtCases.ptpRatePercent ?? 0}%</p>
            )}
          </CardContent>
        </Card>
        <Card className="bg-orange-50 border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500 mb-1">Tỷ lệ thu hồi</p>
            {loadingOverview ? <Skeleton className="h-8 w-16" /> : (
              <p className="text-2xl font-bold text-slate-900">{overview?.debtCases.recoveryRatePercent ?? 0}%</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Dial — C2C via Eyebeam */}
      <QuickDialWidget />

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
                  <div key={agent.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 hover:bg-slate-100 transition-colors">
                    <span className="font-medium text-sm text-slate-700">{agent.fullName}</span>
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${getStatusColor(agent.currentStatus.status)} ring-2 ring-white`} />
                      <Badge variant="outline" className="text-[10px] px-1.5">
                        {VI.agentStatus[agent.currentStatus.status as keyof typeof VI.agentStatus] || agent.currentStatus.status}
                      </Badge>
                      {agent.currentStatus.updatedAt && (
                        <span className="text-[10px] text-slate-400">{timeAgo(agent.currentStatus.updatedAt)}</span>
                      )}
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

        {/* Quick stats */}
        <Card className="shadow-sm border-0 bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Khách hàng tiềm năng</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{overview?.leads.newToday ?? 0}</p>
            <p className="text-xs text-muted-foreground">mới hôm nay</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-0 bg-white">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Phiếu hỗ trợ</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{overview?.tickets.open ?? 0}</p>
            <p className="text-xs text-muted-foreground">đang mở</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
