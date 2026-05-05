import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCustomerTabStore } from '@/stores/customer-tab-store';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Phone, FileText, Calendar, Edit2, PhoneCall, PhoneMissed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ClickToCallButton } from '@/components/click-to-call-button';
import { Badge } from '@/components/ui/badge';
import { DottedCard } from '@/components/ops/dotted-card';
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

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'Mới',
  contacted: 'Đã liên hệ',
  qualified: 'Tiềm năng',
  proposal: 'Đề xuất',
  won: 'Đang làm việc',
  lost: 'Đã mất',
};

/** Derive two-char initials from a full name */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type InfoTab = 'info' | 'calls' | 'files' | 'attachments';

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<InfoTab>('info');

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
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!lead) {
    return <p className="text-muted-foreground">{VI.actions.noData}</p>;
  }

  const contactName = lead.contact?.fullName || 'Khách hàng tiềm năng';
  const statusLabel = STATUS_LABELS[lead.status] ?? VI.lead.statuses[lead.status];
  const isActiveStatus = lead.status === 'won' || lead.status === 'qualified';

  return (
    <div className="space-y-4">
      {/* ── Header card ── */}
      <div className="bg-card rounded-xl shadow-sm p-6 border border-dashed border-border">
        <div className="flex items-start justify-between gap-4">
          {/* Left: avatar + name + status */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-accent/30 border border-dashed border-border flex items-center justify-center font-bold text-xl text-primary font-mono">
              {initials(contactName)}
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-semibold text-foreground">{contactName}</h1>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                    isActiveStatus
                      ? 'bg-amber-100 text-amber-800'
                      : STATUS_COLORS[lead.status]
                  }`}
                >
                  {isActiveStatus && (
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  )}
                  {statusLabel}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                ID: {lead.id.slice(0, 12).toUpperCase()} •&nbsp;
                Tạo lúc: {format(new Date(lead.createdAt), 'HH:mm, dd/MM/yyyy')}
              </p>
            </div>
          </div>

          {/* Right: assignee + edit */}
          <div className="flex items-center gap-3 shrink-0">
            {lead.assignedTo && (
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-1">
                  Người phụ trách
                </p>
                <div className="flex items-center gap-2 bg-muted/40 border border-dashed border-border rounded-lg px-3 py-1.5">
                  <span className="text-sm font-medium">{lead.assignedTo.fullName}</span>
                </div>
              </div>
            )}
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
                  { key: 'files', label: 'Hồ sơ' },
                  { key: 'attachments', label: 'Tệp đính kèm' },
                ] as { key: InfoTab; label: string }[]
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
                <div className="grid grid-cols-2 gap-y-6 gap-x-10">
                  {/* Phone */}
                  {lead.contact?.phone && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                        Số điện thoại
                      </p>
                      <p className="text-sm font-medium text-primary">
                        {fmtPhone(lead.contact.phone)}
                      </p>
                    </div>
                  )}
                  {/* Email — placeholder */}
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                      Email
                    </p>
                    <p className="text-sm font-medium text-foreground">—</p>
                  </div>
                  {/* Campaign / company proxy */}
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                      {VI.lead.campaign}
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {lead.campaign?.name ?? '—'}
                    </p>
                  </div>
                  {/* Source */}
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                      Nguồn Lead
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {lead.source ? (LEAD_SOURCE_LABELS[lead.source] ?? lead.source) : '—'}
                    </p>
                  </div>
                  {/* Follow-up date */}
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                      {VI.lead.followUp}
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {lead.followUpDate
                        ? format(new Date(lead.followUpDate), 'dd/MM/yyyy')
                        : '—'}
                    </p>
                  </div>
                  {/* Lead score */}
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                      {VI.lead.score}
                    </p>
                    {(() => {
                      const score = lead.leadScore ?? lead.score;
                      if (score == null) return <p className="text-sm font-medium">—</p>;
                      const color =
                        score >= 70
                          ? 'bg-[var(--color-status-ok)]/20 text-[var(--color-status-ok)]'
                          : score >= 40
                          ? 'bg-[var(--color-status-warn)]/20 text-[var(--color-status-warn)]'
                          : 'bg-[var(--color-status-err)]/10 text-[var(--color-status-err)]';
                      return <Badge className={color}>{score}/100</Badge>;
                    })()}
                  </div>
                  {/* Notes */}
                  {lead.notes && (
                    <div className="col-span-2 space-y-1">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                        {VI.lead.notes}
                      </p>
                      <p className="text-sm text-muted-foreground bg-muted/40 p-3 rounded-lg border border-dashed border-border">
                        {lead.notes}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'calls' && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Không có lịch sử cuộc gọi
                </p>
              )}

              {activeTab === 'files' && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Không có hồ sơ
                </p>
              )}

              {activeTab === 'attachments' && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Không có tệp đính kèm
                </p>
              )}
            </div>
          </div>

          {/* Call history mini-list */}
          <div className="bg-card rounded-xl shadow-sm border border-dashed border-border overflow-hidden">
            <div className="px-6 py-4 flex justify-between items-center border-b border-dashed border-border">
              <h3 className="text-sm font-bold text-foreground">Lịch sử cuộc gọi gần nhất</h3>
              <button
                onClick={() => navigate(`/contacts/${lead.contact?.id}`)}
                className="text-xs font-bold text-primary hover:underline uppercase"
              >
                Xem tất cả
              </button>
            </div>
            <div className="divide-y divide-dashed divide-border">
              {/* Static sample rows — real data via call-logs page */}
              <div className="px-6 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0">
                    <PhoneCall className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Cuộc gọi đi thành công</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      Thời lượng: 05:24 • Hôm nay, 10:15
                    </p>
                  </div>
                </div>
                <Badge className="bg-[var(--color-status-ok)]/10 text-[var(--color-status-ok)] text-[10px] uppercase">
                  Thành công
                </Badge>
              </div>
              <div className="px-6 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                    <PhoneMissed className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Cuộc gọi nhỡ</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      Hôm qua, 16:30
                    </p>
                  </div>
                </div>
                <Badge className="bg-[var(--color-status-err)]/10 text-[var(--color-status-err)] text-[10px] uppercase">
                  Nhỡ
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Right rail (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Quick actions card */}
          <DottedCard>
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
              Thao tác nhanh
            </h3>
            <div className="space-y-2.5">
              {lead.contact?.phone && (
                <div className="w-full">
                  <ClickToCallButton
                    phone={lead.contact.phone}
                    contactName={lead.contact.fullName}
                  />
                </div>
              )}
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
              >
                <Calendar className="h-4 w-4" />
                Đặt lịch hẹn
              </Button>
            </div>
          </DottedCard>

          {/* Timeline card */}
          <DottedCard className="flex-1">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-6">
              Dòng thời gian
            </h3>
            {/* Vertical dotted line timeline */}
            <div className="relative space-y-8 before:content-[''] before:absolute before:left-4 before:top-2 before:bottom-0 before:w-px before:border-l before:border-dashed before:border-border">
              {/* Event: status updated */}
              <div className="relative pl-10">
                <div className="absolute left-1.5 top-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center ring-2 ring-background">
                  <Edit2 className="h-2.5 w-2.5 text-white" />
                </div>
                <p className="text-xs font-bold text-foreground">Cập nhật trạng thái</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Trạng thái → <span className="text-primary">{statusLabel}</span>
                </p>
                <p className="text-[10px] text-muted-foreground font-mono mt-1">
                  {format(new Date(lead.updatedAt), 'HH:mm - dd/MM/yyyy')}
                </p>
              </div>

              {/* Event: lead created */}
              <div className="relative pl-10">
                <div className="absolute left-1.5 top-1 w-5 h-5 rounded-full bg-accent border border-dashed border-border flex items-center justify-center ring-2 ring-background">
                  <Phone className="h-2.5 w-2.5 text-primary" />
                </div>
                <p className="text-xs font-bold text-foreground">Lead được tạo</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Nguồn: {lead.source ? (LEAD_SOURCE_LABELS[lead.source] ?? lead.source) : 'Không rõ'}
                </p>
                <p className="text-[10px] text-muted-foreground font-mono mt-1">
                  {format(new Date(lead.createdAt), 'HH:mm - dd/MM/yyyy')}
                </p>
              </div>
            </div>
          </DottedCard>
        </div>
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
