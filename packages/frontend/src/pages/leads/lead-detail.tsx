import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft, Edit2, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { VI } from '@/lib/vi-text';
import api from '@/services/api-client';
import type { LeadStatus } from '@shared/constants/enums';
import LeadForm from './lead-form';

interface Lead {
  id: string;
  status: LeadStatus;
  score: number | null;
  notes: string | null;
  followUpDate: string | null;
  createdAt: string;
  updatedAt: string;
  contact: { id: string; fullName: string; phone: string } | null;
  campaign: { id: string; name: string } | null;
  assignedTo: { fullName: string } | null;
}

const STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  qualified: 'bg-green-100 text-green-800',
  proposal: 'bg-purple-100 text-purple-800',
  won: 'bg-emerald-100 text-emerald-800',
  lost: 'bg-red-100 text-red-800',
};

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);

  const { data: lead, isLoading, refetch } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => api.get<{ data: Lead }>(`/leads/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });

  function handleCall() {
    if (!lead?.contact?.phone) return;
    api.post('/calls/originate', { phone: lead.contact.phone }).then(() => {
      toast.success(`Đang gọi ${lead.contact!.phone}...`);
    }).catch(() => toast.error('Không thể thực hiện cuộc gọi'));
  }

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!lead) {
    return <p className="text-muted-foreground">{VI.actions.noData}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/leads')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{lead.contact?.fullName || 'Lead'}</h1>
          <Badge className={STATUS_COLORS[lead.status]}>{VI.lead.statuses[lead.status]}</Badge>
        </div>
        {lead.contact?.phone && (
          <Button variant="outline" onClick={handleCall}>
            <Phone className="mr-2 h-4 w-4" /> Gọi
          </Button>
        )}
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          <Edit2 className="mr-2 h-4 w-4" /> {VI.actions.edit}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Thông tin Lead</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div><p className="text-xs text-muted-foreground">{VI.lead.score}</p><p className="font-medium">{lead.score ?? '—'}</p></div>
            <div><p className="text-xs text-muted-foreground">{VI.lead.campaign}</p><p className="font-medium">{lead.campaign?.name ?? '—'}</p></div>
            <div><p className="text-xs text-muted-foreground">{VI.lead.followUp}</p><p className="font-medium">{lead.followUpDate ? format(new Date(lead.followUpDate), 'dd/MM/yyyy') : '—'}</p></div>
            <div><p className="text-xs text-muted-foreground">{VI.contact.assignedTo}</p><p className="font-medium">{lead.assignedTo?.fullName ?? '—'}</p></div>
            <div><p className="text-xs text-muted-foreground">{VI.contact.createdAt}</p><p className="font-medium">{format(new Date(lead.createdAt), 'dd/MM/yyyy HH:mm')}</p></div>
            {lead.notes && (
              <div className="col-span-2"><p className="text-xs text-muted-foreground">{VI.lead.notes}</p><p>{lead.notes}</p></div>
            )}
          </CardContent>
        </Card>

        {lead.contact && (
          <Card className="cursor-pointer hover:bg-accent/50" onClick={() => navigate(`/contacts/${lead.contact!.id}`)}>
            <CardHeader><CardTitle>{VI.contact.tabs.info}</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-muted-foreground">{VI.contact.fullName}</p><p className="font-medium">{lead.contact.fullName}</p></div>
              <div><p className="text-xs text-muted-foreground">{VI.contact.phone}</p><p className="font-medium">{lead.contact.phone}</p></div>
            </CardContent>
          </Card>
        )}
      </div>

      {editOpen && (
        <LeadForm
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSuccess={() => { setEditOpen(false); refetch(); }}
          initialData={{
            id: lead.id,
            contactId: lead.contact?.id ?? '',
            status: lead.status,
            score: lead.score,
            notes: lead.notes,
            followUpDate: lead.followUpDate,
          }}
        />
      )}
    </div>
  );
}
