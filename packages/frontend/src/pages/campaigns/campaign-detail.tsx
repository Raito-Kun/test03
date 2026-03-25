import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { VI } from '@/lib/vi-text';
import api from '@/services/api-client';
import type { CampaignStatus, CampaignType } from '@shared/constants/enums';

interface CampaignDetail {
  id: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  script: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_COLORS: Record<CampaignStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-blue-100 text-blue-700',
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
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!campaign) {
    return <p className="text-muted-foreground">{VI.actions.noData}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/campaigns')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{campaign.name}</h1>
          <div className="flex gap-2 mt-1">
            <Badge variant="outline">{VI.campaign.types[campaign.type]}</Badge>
            <Badge className={STATUS_COLORS[campaign.status]}>{VI.campaign.statuses[campaign.status]}</Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Thông tin chiến dịch</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div><p className="text-xs text-muted-foreground">{VI.campaign.startDate}</p><p className="font-medium">{campaign.startDate ? format(new Date(campaign.startDate), 'dd/MM/yyyy') : '—'}</p></div>
            <div><p className="text-xs text-muted-foreground">{VI.campaign.endDate}</p><p className="font-medium">{campaign.endDate ? format(new Date(campaign.endDate), 'dd/MM/yyyy') : '—'}</p></div>
            <div><p className="text-xs text-muted-foreground">{VI.contact.createdAt}</p><p className="font-medium">{format(new Date(campaign.createdAt), 'dd/MM/yyyy HH:mm')}</p></div>
          </CardContent>
        </Card>

        {campaign.script && (
          <Card>
            <CardHeader><CardTitle>{VI.campaign.script}</CardTitle></CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap rounded-md bg-muted p-4 text-sm">{campaign.script}</div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
