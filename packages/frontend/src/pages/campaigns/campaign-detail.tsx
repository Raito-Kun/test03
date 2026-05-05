import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Edit, Pause, Calendar, Users, Phone, Banknote, TrendingUp, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { VI } from '@/lib/vi-text';
import api from '@/services/api-client';
import { CampaignInfoForm } from './campaign-info-form';
import { CampaignContactsTab } from './campaign-contacts-tab';
import { CampaignAgentsTab } from './campaign-agents-tab';
import type React from 'react';
import type { CampaignStatus } from '@shared/constants/enums';

interface CampaignDetail {
  id: string;
  name: string;
  type: string;
  status: CampaignStatus;
  category?: string | null;
  queue?: string | null;
  dialMode?: string | null;
  callbackUrl?: string | null;
  workSchedule?: string | null;
  workStartTime?: string | null;
  workEndTime?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  script?: string | null;
  createdAt: string;
  agents?: { assignedAt: string; user: { id: string; fullName: string; email: string; role: string; sipExtension?: string | null } }[];
}

// Status badge config
const STATUS_CONFIG: Record<CampaignStatus, { dot: string; bg: string; text: string; label: string }> = {
  draft:     { dot: 'bg-amber-500',   bg: 'bg-amber-50',    text: 'text-amber-700',   label: 'Bản nháp' },
  active:    { dot: 'bg-green-500',   bg: 'bg-green-100',   text: 'text-green-700',   label: 'Đang chạy' },
  paused:    { dot: 'bg-amber-400',   bg: 'bg-amber-50',    text: 'text-amber-700',   label: 'Tạm dừng' },
  completed: { dot: 'bg-muted-foreground', bg: 'bg-muted', text: 'text-muted-foreground', label: 'Hoàn tất' },
};

function StatusBadge({ status }: { status: CampaignStatus }) {
  const c = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

// Activity timeline entry
interface ActivityEntry {
  icon: React.ReactNode;
  iconBg: string;
  content: React.ReactNode;
  time: string;
}

const SAMPLE_ACTIVITIES: ActivityEntry[] = [
  {
    icon: <Phone className="h-2.5 w-2.5 text-green-700" />,
    iconBg: 'bg-green-100',
    content: (
      <p className="text-sm">
        <span className="font-bold">Lê Minh</span> đã hoàn thành cuộc gọi với{' '}
        <span className="font-bold">KH: 090****123</span>
        <br />
        <span className="text-xs text-muted-foreground">Kết quả: Đã cam kết trả nợ ngày 15/11</span>
      </p>
    ),
    time: '2 phút trước',
  },
  {
    icon: <Users className="h-2.5 w-2.5 text-primary" />,
    iconBg: 'bg-accent',
    content: (
      <p className="text-sm">
        <span className="font-bold">Admin</span> đã thêm <span className="font-bold">Trần An</span> vào chiến dịch
      </p>
    ),
    time: '15 phút trước',
  },
  {
    icon: <AlertCircle className="h-2.5 w-2.5 text-destructive" />,
    iconBg: 'bg-destructive/10',
    content: (
      <p className="text-sm">
        Phát hiện <span className="font-bold">3 cuộc gọi</span> bị nhỡ do quá tải hệ thống
        <br />
        <span className="text-xs text-destructive font-medium">Cần kiểm tra cấu hình Cluster HCM_01</span>
      </p>
    ),
    time: '1 giờ trước',
  },
];

function formatDateRange(start?: string | null, end?: string | null): string {
  const fmt = (s: string) => {
    const d = new Date(s);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };
  if (start && end) return `${fmt(start)} - ${fmt(end)}`;
  if (start) return `Từ ${fmt(start)}`;
  if (end) return `Đến ${fmt(end)}`;
  return '—';
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: campaign, isLoading } = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => api.get<{ data: CampaignDetail }>(`/campaigns/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[70vh] w-full" />
      </div>
    );
  }

  if (!campaign) {
    return <p className="text-muted-foreground">{VI.actions.noData}</p>;
  }

  const agentCount = campaign.agents?.length ?? 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header card */}
      <section className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-5">
        {/* Title row */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            {/* Breadcrumb */}
            <button
              onClick={() => navigate('/campaigns')}
              className="text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
            >
              Chiến dịch /
            </button>
            {/* Title + status */}
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground leading-tight">{campaign.name}</h1>
              <StatusBadge status={campaign.status} />
            </div>
            {/* Meta row */}
            <p className="text-sm text-muted-foreground flex items-center gap-4 flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formatDateRange(campaign.startDate, campaign.endDate)}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {agentCount} Agents
              </span>
            </p>
          </div>
          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Pause className="h-3.5 w-3.5" />
              Tạm dừng
            </Button>
            <Button size="sm" className="gap-1.5 bg-primary text-primary-foreground hover:opacity-90">
              <Edit className="h-3.5 w-3.5" />
              Sửa chiến dịch
            </Button>
          </div>
        </div>

        {/* Progress + stats row */}
        <div className="grid grid-cols-3 gap-6 pt-4 border-t border-dashed border-border">
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Tiến độ hoàn thành</span>
              <span className="font-mono text-[11px] font-bold text-primary">65%</span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: '65%' }} />
            </div>
          </div>

          {/* Calls stat */}
          <div className="flex items-center gap-4 border-l border-dashed border-border pl-6">
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
              <Phone className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Tổng cuộc gọi</p>
              <p className="font-mono text-lg font-bold">12,450</p>
            </div>
          </div>

          {/* Revenue stat */}
          <div className="flex items-center gap-4 border-l border-dashed border-border pl-6">
            <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center shrink-0">
              <Banknote className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Đã thu hồi</p>
              <p className="font-mono text-lg font-bold">1.2B VNĐ</p>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <Tabs defaultValue="agents">
        <TabsList className="border-b border-border rounded-none bg-transparent h-auto p-0 gap-6">
          <TabsTrigger
            value="info"
            className="pb-3 text-sm font-medium text-muted-foreground data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent px-0"
          >
            Thông tin
          </TabsTrigger>
          <TabsTrigger
            value="contacts"
            className="pb-3 text-sm font-medium text-muted-foreground data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent px-0"
          >
            Liên hệ
          </TabsTrigger>
          <TabsTrigger
            value="agents"
            className="pb-3 text-sm font-medium text-muted-foreground data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent px-0 relative"
          >
            Agents
            {agentCount > 0 && (
              <span className="absolute -top-1 -right-4 px-1.5 py-0.5 bg-primary text-primary-foreground text-[10px] rounded-full font-bold leading-none">
                {agentCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="config"
            className="pb-3 text-sm font-medium text-muted-foreground data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent px-0"
          >
            Cấu hình
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-6">
          <div className="bg-card rounded-xl border border-border p-6 max-w-2xl">
            <CampaignInfoForm campaign={campaign} />
          </div>
        </TabsContent>

        <TabsContent value="contacts" className="mt-6">
          <CampaignContactsTab campaignId={campaign.id} />
        </TabsContent>

        <TabsContent value="agents" className="mt-6 space-y-6">
          {/* Agent grid */}
          <CampaignAgentsTab campaignId={campaign.id} agents={campaign.agents ?? []} />
        </TabsContent>

        <TabsContent value="config" className="mt-6">
          <div className="bg-card rounded-xl border border-border p-6">
            <p className="text-sm text-muted-foreground">Cấu hình chiến dịch sẽ hiển thị tại đây.</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Activity timeline */}
      <section className="bg-card rounded-xl border border-border shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base font-bold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Hoạt động gần đây
          </h3>
          <button className="text-xs font-bold text-primary hover:underline">Xem tất cả</button>
        </div>

        {/* Timeline */}
        <div className="space-y-6 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-px before:border-l before:border-dashed before:border-border">
          {SAMPLE_ACTIVITIES.map((act, i) => (
            <div key={i} className="relative pl-10">
              <div className={`absolute left-1.5 top-1 w-5 h-5 rounded-full ${act.iconBg} flex items-center justify-center border-2 border-background`}>
                {act.icon}
              </div>
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">{act.content}</div>
                <span className="font-mono text-[10px] uppercase text-muted-foreground whitespace-nowrap shrink-0">
                  {act.time}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Floating Action Button */}
      <button
        className="fixed bottom-8 right-8 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center group z-50"
        title="Thêm liên hệ mới"
      >
        <Plus className="h-6 w-6" />
        <span className="absolute right-16 bg-foreground text-background px-3 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          Thêm liên hệ mới
        </span>
      </button>
    </div>
  );
}
