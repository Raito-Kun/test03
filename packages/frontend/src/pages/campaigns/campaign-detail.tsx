import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { VI } from '@/lib/vi-text';
import api from '@/services/api-client';
import { CampaignInfoForm } from './campaign-info-form';
import { CampaignContactsTab } from './campaign-contacts-tab';
import { CampaignAgentsTab } from './campaign-agents-tab';
import { DottedCard } from '@/components/ops/dotted-card';
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

const STATUS_STYLE: Record<CampaignStatus, React.CSSProperties> = {
  draft: { color: 'var(--color-status-warn)' },
  active: { color: 'var(--color-status-ok)' },
  paused: { color: 'var(--color-status-warn)' },
  completed: { color: 'var(--color-status-err)' },
};

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: campaign, isLoading } = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => api.get<{ data: CampaignDetail }>(`/campaigns/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-[70vh] w-full" /></div>;
  }

  if (!campaign) {
    return <p className="text-muted-foreground">{VI.actions.noData}</p>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/campaigns')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Danh sách chiến dịch</span>
        <div className="flex items-center gap-3 ml-auto">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {VI.campaign.types[campaign.type as keyof typeof VI.campaign.types] ?? campaign.type}
          </span>
          <span className="font-mono text-[11px] uppercase tracking-wider" style={STATUS_STYLE[campaign.status]}>
            {VI.campaign.statuses[campaign.status]}
          </span>
        </div>
      </div>

      {/* Split view: left form + right tabs */}
      <div className="flex gap-6 items-start">
        {/* Left panel */}
        <DottedCard header="Thông tin chiến dịch" className="w-2/5 shrink-0 overflow-y-auto max-h-[80vh]">
          <CampaignInfoForm campaign={campaign} />
        </DottedCard>

        {/* Right panel - Tabs */}
        <div className="flex-1 min-w-0">
          <Tabs defaultValue="contacts">
            <TabsList>
              <TabsTrigger value="contacts">{VI.campaign.contactList}</TabsTrigger>
              <TabsTrigger value="agents">{VI.campaign.agentList}</TabsTrigger>
            </TabsList>
            <TabsContent value="contacts" className="mt-3">
              <CampaignContactsTab campaignId={campaign.id} />
            </TabsContent>
            <TabsContent value="agents" className="mt-3">
              <CampaignAgentsTab campaignId={campaign.id} agents={campaign.agents ?? []} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
