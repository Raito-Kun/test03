import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCustomerTabStore } from '@/stores/customer-tab-store';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ClickToCallButton } from '@/components/click-to-call-button';
import { Badge } from '@/components/ui/badge';
import { DottedCard } from '@/components/ops/dotted-card';
import { SectionHeader } from '@/components/ops/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { VI } from '@/lib/vi-text';
import { fmtPhone } from '@/lib/format';
import api from '@/services/api-client';
import type { LeadStatus } from '@shared/constants/enums';
import LeadForm from './lead-form';

const LEAD_SOURCE_LABELS: Record<string, string> = {
  website: 'Website', referral: 'Giới thiệu', phone: 'Điện thoại',
  email: 'Email', social: 'Mạng xã hội', other: 'Khác',
};

interface Lead {
  id: string;
  status: LeadStatus;
  score: number | null;
  leadScore: number | null;
  source: string | null;
  notes: string | null;
  followUpDate: string | null;
  createdAt: string;
  updatedAt: string;
  contact: { id: string; fullName: string; phone: string } | null;
  campaign: { id: string; name: string } | null;
  assignedTo: { fullName: string } | null;
}

const STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-[var(--color-status-ok)]/10 text-[var(--color-status-ok)]',
  contacted: 'bg-[var(--color-status-warn)]/10 text-[var(--color-status-warn)]',
  qualified: 'bg-[var(--color-status-ok)]/20 text-[var(--color-status-ok)]',
  proposal: 'bg-violet-100 text-violet-800',
  won: 'bg-[var(--color-status-ok)]/30 text-[var(--color-status-ok)]',
  lost: 'bg-[var(--color-status-err)]/10 text-[var(--color-status-err)]',
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

  const updateTabLabel = useCustomerTabStore((s) => s.updateTabLabel);
  useEffect(() => {
    if (id && lead?.contact?.fullName) updateTabLabel(id, lead.contact.fullName);
  }, [id, lead?.contact?.fullName, updateTabLabel]);

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!lead) {
    return <p className="text-muted-foreground">{VI.actions.noData}</p>;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        label={lead.contact?.fullName || 'Lead'}
        hint={<Badge className={STATUS_COLORS[lead.status]}>{VI.lead.statuses[lead.status]}</Badge>}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate('/leads')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            {lead.contact?.phone && (
              <ClickToCallButton phone={lead.contact.phone} contactName={lead.contact.fullName} />
            )}
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Edit2 className="mr-2 h-4 w-4" /> {VI.actions.edit}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <DottedCard header="Thông tin Lead">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{VI.lead.score}</p>
              {(() => {
                const score = lead.leadScore ?? lead.score;
                if (score == null) return <p className="font-medium">—</p>;
                const color = score >= 70 ? 'bg-[var(--color-status-ok)]/20 text-[var(--color-status-ok)]' : score >= 40 ? 'bg-[var(--color-status-warn)]/20 text-[var(--color-status-warn)]' : 'bg-[var(--color-status-err)]/10 text-[var(--color-status-err)]';
                return <Badge className={color}>{score}/100</Badge>;
              })()}
            </div>
            <div><p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{VI.lead.campaign}</p><p className="font-medium">{lead.campaign?.name ?? '—'}</p></div>
            <div><p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Nguồn</p><p className="font-medium">{lead.source ? (LEAD_SOURCE_LABELS[lead.source] ?? lead.source) : '—'}</p></div>
            <div><p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{VI.lead.followUp}</p><p className="font-medium">{lead.followUpDate ? format(new Date(lead.followUpDate), 'dd/MM/yyyy') : '—'}</p></div>
            <div><p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{VI.contact.assignedTo}</p><p className="font-medium">{lead.assignedTo?.fullName ?? '—'}</p></div>
            <div><p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{VI.contact.createdAt}</p><p className="font-medium">{format(new Date(lead.createdAt), 'dd/MM/yyyy HH:mm')}</p></div>
            {lead.notes && (
              <div className="col-span-2"><p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{VI.lead.notes}</p><p>{lead.notes}</p></div>
            )}
          </div>
        </DottedCard>

        {lead.contact && (
          <DottedCard header={VI.contact.tabs.info} className="cursor-pointer hover:bg-accent/50" onClick={() => navigate(`/contacts/${lead.contact!.id}`)}>
            <div className="grid grid-cols-2 gap-4">
              <div><p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{VI.contact.fullName}</p><p className="font-medium">{lead.contact.fullName}</p></div>
              <div><p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{VI.contact.phone}</p><p className="font-medium">{fmtPhone(lead.contact.phone)}</p></div>
            </div>
          </DottedCard>
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
