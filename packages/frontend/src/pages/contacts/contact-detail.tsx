import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCustomerTabStore } from '@/stores/customer-tab-store';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ClickToCallButton } from '@/components/click-to-call-button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { DottedCard } from '@/components/ops/dotted-card';
import { Skeleton } from '@/components/ui/skeleton';
import { AudioPlayer } from '@/components/audio-player';
import { VI } from '@/lib/vi-text';
import api, { getAccessToken } from '@/services/api-client';
import { formatDuration, fmtPhone } from '@/lib/format';
import { CustomerSummaryCard } from '@/components/ai/customer-summary-card';
import { ContactForm } from './contact-form';
import { cn } from '@/lib/utils';

interface Contact {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  source?: string;
  tags?: string[];
  notes?: string;
  assignedTo?: { fullName: string };
  createdAt: string;
}

interface Ticket {
  id: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
}

interface CallLog {
  id: string;
  direction: string;
  duration: number;
  disposition?: string;
  recordingUrl?: string;
  startTime: string;
}

interface TimelineEntry {
  id: string;
  type: string;
  description: string;
  createdAt: string;
}

type ActivePanel = 'info' | 'calls' | 'tickets';

const NAV_ITEMS: { key: ActivePanel; label: string }[] = [
  { key: 'info', label: 'Thông tin' },
  { key: 'calls', label: 'Cuộc gọi' },
  { key: 'tickets', label: 'Ticket' },
];

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel>('info');

  const { data: contact, isLoading } = useQuery({
    queryKey: ['contact', id],
    queryFn: () => api.get<{ data: Contact }>(`/contacts/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });

  const { data: tickets } = useQuery({
    queryKey: ['contact-tickets', id],
    queryFn: () => api.get(`/tickets`, { params: { contactId: id } }).then((r) => r.data.data?.items ?? []) as Promise<Ticket[]>,
    enabled: !!id,
  });

  const { data: calls } = useQuery({
    queryKey: ['contact-calls', id],
    queryFn: () => api.get(`/call-logs`, { params: { contactId: id } }).then((r) => r.data.data?.items ?? []) as Promise<CallLog[]>,
    enabled: !!id,
  });

  const { data: timeline } = useQuery({
    queryKey: ['contact-timeline', id],
    queryFn: () => api.get<{ data: TimelineEntry[] }>(`/contacts/${id}/timeline`).then((r) => r.data.data),
    enabled: !!id,
  });

  const updateTabLabel = useCustomerTabStore((s) => s.updateTabLabel);
  useEffect(() => {
    if (id && contact?.fullName) updateTabLabel(id, contact.fullName);
  }, [id, contact?.fullName, updateTabLabel]);

  if (isLoading) {
    return (
      <div className="flex h-full gap-0">
        <div className="w-60 shrink-0 border-r bg-white p-4 space-y-3">
          <Skeleton className="h-20 w-20 rounded-full mx-auto" />
          <Skeleton className="h-5 w-36 mx-auto" />
          <Skeleton className="h-4 w-24 mx-auto" />
        </div>
        <div className="flex-1 p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!contact) {
    return <p className="text-muted-foreground">{VI.actions.noData}</p>;
  }

  const initials = contact.fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-full gap-0">
      {/* Left Panel */}
      <div className="w-60 shrink-0 border-r border-dashed bg-background p-4 flex flex-col items-center overflow-y-auto">
        {/* Avatar */}
        <div className="h-20 w-20 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-white text-2xl font-bold mb-3 shrink-0">
          {initials}
        </div>

        {/* Name & Phone */}
        <h2 className="text-base font-bold text-center leading-tight">{contact.fullName}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{fmtPhone(contact.phone)}</p>

        {/* Action buttons */}
        <div className="flex gap-2 mt-3">
          <ClickToCallButton phone={contact.phone} contactName={contact.fullName} />
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Edit2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Mini nav */}
        <div className="w-full mt-6 space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => setActivePanel(item.key)}
              className={cn(
                'w-full text-left px-3 py-2 rounded-lg font-mono text-[11px] uppercase tracking-wider transition-colors',
                activePanel === item.key
                  ? 'bg-[var(--color-primary,hsl(var(--primary)))]/10 text-[hsl(var(--primary))] font-medium'
                  : 'text-muted-foreground hover:bg-muted/50'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Contact details summary */}
        <div className="w-full mt-5 space-y-2 text-sm border-t border-dashed pt-4">
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{VI.contact.email}</span>
            <span className="font-medium truncate">{contact.email || '—'}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{VI.contact.source}</span>
            <span className="font-medium">{contact.source || '—'}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{VI.contact.assignedTo}</span>
            <span className="font-medium">{contact.assignedTo?.fullName || '—'}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{VI.contact.createdAt}</span>
            <span className="font-medium">{format(new Date(contact.createdAt), 'dd/MM/yyyy')}</span>
          </div>
          {contact.tags && contact.tags.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{VI.contact.tags}</span>
              <div className="flex flex-wrap gap-1">
                {contact.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 overflow-auto p-6">
        {activePanel === 'info' && (
          <div className="space-y-6">
            {/* AI Customer Summary */}
            <CustomerSummaryCard
              contactId={contact.id}
              customerData={JSON.stringify({ name: contact.fullName, phone: contact.phone, email: contact.email, tags: contact.tags, notes: contact.notes })}
            />

            {/* Info card */}
            <DottedCard header="Thông tin liên hệ">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div><p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{VI.contact.email}</p><p className="font-medium">{contact.email || '—'}</p></div>
                <div><p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{VI.contact.source}</p><p className="font-medium">{contact.source || '—'}</p></div>
                <div><p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{VI.contact.assignedTo}</p><p className="font-medium">{contact.assignedTo?.fullName || '—'}</p></div>
                <div><p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{VI.contact.createdAt}</p><p className="font-medium">{format(new Date(contact.createdAt), 'dd/MM/yyyy HH:mm')}</p></div>
                {contact.tags && contact.tags.length > 0 && (
                  <div className="col-span-full">
                    <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{VI.contact.tags}</p>
                    <div className="flex gap-1">{contact.tags.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}</div>
                  </div>
                )}
                {contact.notes && (
                  <div className="col-span-full">
                    <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{VI.lead.notes}</p>
                    <p>{contact.notes}</p>
                  </div>
                )}
              </div>
            </DottedCard>

            {/* Timeline */}
            <div>
              <h3 className="font-mono text-[11px] uppercase tracking-wider mb-3 text-muted-foreground">{VI.contact.tabs.timeline}</h3>
              {(!timeline || timeline.length === 0) && <p className="text-sm text-muted-foreground">{VI.actions.noData}</p>}
              <div className="space-y-2">
                {timeline?.map((entry) => (
                  <div key={entry.id} className="flex gap-3 border-l-2 border-muted pl-4 py-2">
                    <div>
                      <p className="text-sm">{entry.description}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(entry.createdAt), 'dd/MM/yyyy HH:mm')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activePanel === 'calls' && (
          <div className="space-y-2">
            <h3 className="font-mono text-[11px] uppercase tracking-wider mb-3 text-muted-foreground">{VI.contact.tabs.calls}</h3>
            {(!calls || calls.length === 0) && <p className="text-sm text-muted-foreground">{VI.actions.noData}</p>}
            {calls?.map((c) => (
              <Card key={c.id} className="cursor-pointer hover:bg-accent/50" onClick={() => navigate(`/call-logs/${c.id}`)}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={c.direction === 'inbound' ? 'default' : 'secondary'}>
                        {c.direction === 'inbound' ? VI.callLog.inbound : VI.callLog.outbound}
                      </Badge>
                      <span className="text-sm">{formatDuration(c.duration)}</span>
                      <span className="text-sm text-muted-foreground">{format(new Date(c.startTime), 'dd/MM/yyyy HH:mm')}</span>
                    </div>
                    {c.disposition && <Badge variant="outline">{c.disposition}</Badge>}
                  </div>
                  {c.recordingUrl && (
                    <div className="mt-2">
                      <AudioPlayer src={`${c.recordingUrl.startsWith('http') ? c.recordingUrl : window.location.origin + c.recordingUrl}?token=${getAccessToken()}`} />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {activePanel === 'tickets' && (
          <div className="space-y-2">
            <h3 className="font-mono text-[11px] uppercase tracking-wider mb-3 text-muted-foreground">{VI.contact.tabs.tickets}</h3>
            {(!tickets || tickets.length === 0) && <p className="text-sm text-muted-foreground">{VI.actions.noData}</p>}
            {tickets?.map((t) => (
              <Card key={t.id} className="cursor-pointer hover:bg-accent/50" onClick={() => navigate(`/tickets/${t.id}`)}>
                <CardContent className="flex items-center justify-between py-3">
                  <div>
                    <span className="font-medium">{t.category}</span>
                    <span className="ml-2 text-sm text-muted-foreground">{format(new Date(t.createdAt), 'dd/MM/yyyy')}</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{VI.ticket.priorities[t.priority as keyof typeof VI.ticket.priorities] || t.priority}</Badge>
                    <Badge>{VI.ticket.statuses[t.status as keyof typeof VI.ticket.statuses] || t.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <ContactForm open={editOpen} onClose={() => setEditOpen(false)} contact={contact} />
    </div>
  );
}
