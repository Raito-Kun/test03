import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft, Phone, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { AudioPlayer } from '@/components/audio-player';
import { VI } from '@/lib/vi-text';
import api from '@/services/api-client';
import { formatDuration } from '@/lib/format';
import { ContactForm } from './contact-form';

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

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);

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

  function handleCall() {
    if (!contact) return;
    api.post('/calls/originate', { phone: contact.phone }).then(() => {
      toast.success(`Đang gọi ${contact.phone}...`);
    }).catch(() => toast.error('Không thể thực hiện cuộc gọi'));
  }

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!contact) {
    return <p className="text-muted-foreground">{VI.actions.noData}</p>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/contacts')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{contact.fullName}</h1>
          <p className="text-muted-foreground">{contact.phone}</p>
        </div>
        <Button variant="outline" onClick={handleCall}>
          <Phone className="mr-2 h-4 w-4" /> Gọi
        </Button>
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          <Edit2 className="mr-2 h-4 w-4" /> {VI.actions.edit}
        </Button>
      </div>

      {/* Info card */}
      <Card>
        <CardContent className="grid grid-cols-2 gap-4 pt-6 md:grid-cols-4">
          <div><p className="text-xs text-muted-foreground">{VI.contact.email}</p><p className="font-medium">{contact.email || '—'}</p></div>
          <div><p className="text-xs text-muted-foreground">{VI.contact.source}</p><p className="font-medium">{contact.source || '—'}</p></div>
          <div><p className="text-xs text-muted-foreground">{VI.contact.assignedTo}</p><p className="font-medium">{contact.assignedTo?.fullName || '—'}</p></div>
          <div><p className="text-xs text-muted-foreground">{VI.contact.createdAt}</p><p className="font-medium">{format(new Date(contact.createdAt), 'dd/MM/yyyy HH:mm')}</p></div>
          {contact.tags && contact.tags.length > 0 && (
            <div className="col-span-full">
              <p className="text-xs text-muted-foreground mb-1">{VI.contact.tags}</p>
              <div className="flex gap-1">{contact.tags.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}</div>
            </div>
          )}
          {contact.notes && (
            <div className="col-span-full">
              <p className="text-xs text-muted-foreground">{VI.lead.notes}</p>
              <p>{contact.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="tickets">
        <TabsList>
          <TabsTrigger value="tickets">{VI.contact.tabs.tickets}</TabsTrigger>
          <TabsTrigger value="calls">{VI.contact.tabs.calls}</TabsTrigger>
          <TabsTrigger value="timeline">{VI.contact.tabs.timeline}</TabsTrigger>
        </TabsList>

        <TabsContent value="tickets" className="space-y-2 mt-4">
          {tickets?.length === 0 && <p className="text-sm text-muted-foreground">{VI.actions.noData}</p>}
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
        </TabsContent>

        <TabsContent value="calls" className="space-y-2 mt-4">
          {calls?.length === 0 && <p className="text-sm text-muted-foreground">{VI.actions.noData}</p>}
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
                {c.recordingUrl && <div className="mt-2"><AudioPlayer src={c.recordingUrl} /></div>}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="timeline" className="space-y-2 mt-4">
          {timeline?.length === 0 && <p className="text-sm text-muted-foreground">{VI.actions.noData}</p>}
          {timeline?.map((entry) => (
            <div key={entry.id} className="flex gap-3 border-l-2 border-muted pl-4 py-2">
              <div>
                <p className="text-sm">{entry.description}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(entry.createdAt), 'dd/MM/yyyy HH:mm')}</p>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>

      <ContactForm open={editOpen} onClose={() => setEditOpen(false)} contact={contact} />
    </div>
  );
}
