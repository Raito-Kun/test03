import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCustomerTabStore } from '@/stores/customer-tab-store';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Edit2, FileText, Phone, PhoneCall, PhoneMissed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ClickToCallButton } from '@/components/click-to-call-button';
import { Badge } from '@/components/ui/badge';
import { DottedCard } from '@/components/ops/dotted-card';
import { Skeleton } from '@/components/ui/skeleton';
import { AudioPlayer } from '@/components/audio-player';
import { VI } from '@/lib/vi-text';
import api, { getAccessToken } from '@/services/api-client';
import { formatDuration, fmtPhone } from '@/lib/format';
import { CustomerSummaryCard } from '@/components/ai/customer-summary-card';
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

type ActiveTab = 'info' | 'calls' | 'tickets' | 'attachments';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function segmentPillClass(tag: string) {
  const lower = tag.toLowerCase();
  if (lower === 'vip')
    return 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-violet-100 text-violet-800 text-xs font-bold uppercase border border-violet-200';
  if (lower === 'tiềm năng' || lower === 'tiem nang')
    return 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold uppercase border border-amber-200';
  return 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-bold uppercase';
}

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('info');

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
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!contact) {
    return <p className="text-muted-foreground">{VI.actions.noData}</p>;
  }

  const firstTag = contact.tags?.[0];

  return (
    <div className="space-y-4">
      {/* ── Header card ── */}
      <div className="bg-card rounded-xl shadow-sm p-6 border border-dashed border-border">
        <div className="flex items-start justify-between gap-4">
          {/* Left: avatar + name + segment */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-accent/30 border border-dashed border-border flex items-center justify-center font-bold text-xl text-primary font-mono">
              {initials(contact.fullName)}
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-semibold text-foreground">{contact.fullName}</h2>
                {firstTag && (
                  <span className={segmentPillClass(firstTag)}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {firstTag}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                ID: {contact.id.slice(0, 12).toUpperCase()} •&nbsp;
                Tạo lúc: {format(new Date(contact.createdAt), 'HH:mm, dd/MM/yyyy')}
              </p>
            </div>
          </div>

          {/* Right: action stack */}
          <div className="flex items-center gap-2 shrink-0">
            <ClickToCallButton phone={contact.phone} contactName={contact.fullName} />
            <Button
              variant="outline"
              className="h-9 border-dashed font-bold text-sm gap-2"
              onClick={() => navigate('/tickets')}
            >
              <FileText className="h-4 w-4" />
              Tạo phiếu
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Edit2 className="mr-1.5 h-3.5 w-3.5" /> Sửa
            </Button>
          </div>
        </div>
      </div>

      {/* ── 8/4 grid ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left column (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {/* Tabbed info card */}
          <div className="bg-card rounded-xl shadow-sm border border-dashed border-border overflow-hidden">
            {/* Tab strip */}
            <div className="flex border-b border-dashed border-border px-6">
              {(
                [
                  { key: 'info', label: 'Thông tin' },
                  { key: 'calls', label: 'Lịch sử cuộc gọi' },
                  { key: 'tickets', label: 'Phiếu ghi' },
                  { key: 'attachments', label: 'Tệp đính kèm' },
                ] as { key: ActiveTab; label: string }[]
              ).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`px-4 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === t.key
                      ? 'font-bold text-primary border-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab body */}
            <div className="p-6">
              {activeTab === 'info' && (
                <div className="space-y-6">
                  <CustomerSummaryCard
                    contactId={contact.id}
                    customerData={JSON.stringify({ name: contact.fullName, phone: contact.phone, email: contact.email, tags: contact.tags, notes: contact.notes })}
                  />
                  <div className="grid grid-cols-2 gap-y-6 gap-x-10">
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Số điện thoại</p>
                      <p className="text-sm font-medium text-primary">{fmtPhone(contact.phone)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{VI.contact.email}</p>
                      <p className="text-sm font-medium text-foreground">{contact.email || '—'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{VI.contact.source}</p>
                      <p className="text-sm font-medium text-foreground">{contact.source || '—'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{VI.contact.assignedTo}</p>
                      <p className="text-sm font-medium text-foreground">{contact.assignedTo?.fullName || '—'}</p>
                    </div>
                    {contact.tags && contact.tags.length > 0 && (
                      <div className="col-span-2 space-y-1">
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{VI.contact.tags}</p>
                        <div className="flex flex-wrap gap-1">
                          {contact.tags.map((t) => (
                            <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {contact.notes && (
                      <div className="col-span-2 space-y-1">
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{VI.lead.notes}</p>
                        <p className="text-sm text-muted-foreground bg-muted/40 p-3 rounded-lg border border-dashed border-border">
                          {contact.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'calls' && (
                <div className="space-y-2">
                  {(!calls || calls.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-6">Không có lịch sử cuộc gọi</p>
                  )}
                  {calls?.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-dashed border-border hover:bg-muted/30 cursor-pointer"
                      onClick={() => navigate(`/call-logs/${c.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                          c.disposition === 'ANSWERED'
                            ? 'bg-green-100 text-green-600'
                            : 'bg-red-100 text-red-600'
                        }`}>
                          {c.disposition === 'ANSWERED'
                            ? <PhoneCall className="h-4 w-4" />
                            : <PhoneMissed className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {c.direction === 'inbound' ? VI.callLog.inbound : VI.callLog.outbound}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {formatDuration(c.duration)} • {format(new Date(c.startTime), 'HH:mm, dd/MM/yyyy')}
                          </p>
                        </div>
                      </div>
                      <Badge
                        className={c.disposition === 'ANSWERED'
                          ? 'bg-[var(--color-status-ok)]/10 text-[var(--color-status-ok)] text-[10px] uppercase'
                          : 'bg-[var(--color-status-err)]/10 text-[var(--color-status-err)] text-[10px] uppercase'
                        }
                      >
                        {c.disposition === 'ANSWERED' ? 'Đã trả lời' : 'Nhỡ'}
                      </Badge>
                      {c.recordingUrl && (
                        <div className="mt-2 w-full">
                          <AudioPlayer src={`${c.recordingUrl.startsWith('http') ? c.recordingUrl : window.location.origin + c.recordingUrl}?token=${getAccessToken()}`} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'tickets' && (
                <div className="space-y-2">
                  {(!tickets || tickets.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-6">Không có phiếu ghi</p>
                  )}
                  {tickets?.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-dashed border-border hover:bg-muted/30 cursor-pointer"
                      onClick={() => navigate(`/tickets/${t.id}`)}
                    >
                      <div>
                        <span className="font-medium text-sm">{t.category}</span>
                        <span className="ml-2 text-xs text-muted-foreground font-mono">
                          {format(new Date(t.createdAt), 'dd/MM/yyyy')}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline">{VI.ticket.priorities[t.priority as keyof typeof VI.ticket.priorities] || t.priority}</Badge>
                        <Badge>{VI.ticket.statuses[t.status as keyof typeof VI.ticket.statuses] || t.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'attachments' && (
                <p className="text-sm text-muted-foreground text-center py-6">Không có tệp đính kèm</p>
              )}
            </div>
          </div>

          {/* Timeline */}
          {timeline && timeline.length > 0 && (
            <div className="bg-card rounded-xl shadow-sm border border-dashed border-border p-6">
              <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
                {VI.contact.tabs.timeline}
              </h3>
              <div className="relative space-y-6 before:content-[''] before:absolute before:left-3 before:top-2 before:bottom-0 before:w-px before:border-l before:border-dashed before:border-border">
                {timeline.map((entry) => (
                  <div key={entry.id} className="relative pl-9">
                    <div className="absolute left-0.5 top-1 w-5 h-5 rounded-full bg-accent border border-dashed border-border flex items-center justify-center ring-2 ring-background">
                      <Phone className="h-2.5 w-2.5 text-primary" />
                    </div>
                    <p className="text-xs font-bold text-foreground">{entry.description}</p>
                    <p className="text-[10px] text-muted-foreground font-mono mt-1">
                      {format(new Date(entry.createdAt), 'HH:mm - dd/MM/yyyy')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right rail (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <DottedCard>
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
              Thao tác nhanh
            </h3>
            <div className="space-y-2.5">
              <div className="w-full">
                <ClickToCallButton phone={contact.phone} contactName={contact.fullName} />
              </div>
              <Button
                variant="outline"
                className="w-full h-11 border-dashed font-bold text-sm gap-2"
                onClick={() => navigate('/tickets')}
              >
                <FileText className="h-4 w-4" />
                Tạo phiếu ghi
              </Button>
              <Button
                variant="outline"
                className="w-full h-11 border-dashed font-bold text-sm gap-2"
                onClick={() => setEditOpen(true)}
              >
                <Edit2 className="h-4 w-4" />
                Sửa thông tin
              </Button>
            </div>
          </DottedCard>

          {/* Recent calls mini-card */}
          <DottedCard className="flex-1">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Cuộc gọi gần nhất
              </h3>
              <button
                onClick={() => setActiveTab('calls')}
                className="text-xs font-bold text-primary hover:underline uppercase"
              >
                Xem tất cả
              </button>
            </div>
            <div className="space-y-3">
              {(!calls || calls.length === 0) && (
                <p className="text-xs text-muted-foreground text-center py-4">Chưa có cuộc gọi</p>
              )}
              {calls?.slice(0, 3).map((c) => (
                <div key={c.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      c.disposition === 'ANSWERED' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                    }`}>
                      {c.disposition === 'ANSWERED'
                        ? <PhoneCall className="h-3 w-3" />
                        : <PhoneMissed className="h-3 w-3" />}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      {format(new Date(c.startTime), 'dd/MM/yy HH:mm')}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                    c.disposition === 'ANSWERED'
                      ? 'bg-[var(--color-status-ok)]/10 text-[var(--color-status-ok)]'
                      : 'bg-[var(--color-status-err)]/10 text-[var(--color-status-err)]'
                  }`}>
                    {c.disposition === 'ANSWERED' ? '✓' : '✗'}
                  </span>
                </div>
              ))}
            </div>
          </DottedCard>
        </div>
      </div>

      <ContactForm open={editOpen} onClose={() => setEditOpen(false)} contact={contact} />
    </div>
  );
}
