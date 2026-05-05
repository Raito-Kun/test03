import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft, Download, FileText, Phone, CheckCircle2, Clock, PhoneOff, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AudioPlayer } from '@/components/audio-player';
import { VI } from '@/lib/vi-text';
import api, { getAccessToken } from '@/services/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { formatDuration, fmtPhone, buildRecordingFilename } from '@/lib/format';
import { CallLogTicketDialog } from './call-log-ticket-dialog';

const HANGUP_CAUSE_VI: Record<string, string> = {
  NORMAL_CLEARING: 'Thành công',
  ORIGINATOR_CANCEL: 'Hủy',
  NO_ANSWER: 'Không trả lời',
  USER_BUSY: 'Máy bận',
  CALL_REJECTED: 'Từ chối cuộc gọi',
  UNALLOCATED_NUMBER: 'Số không tồn tại',
  NO_ROUTE_DESTINATION: 'Không tìm thấy đích',
  RECOVERY_ON_TIMER_EXPIRE: 'Hết thời gian',
  SUBSCRIBER_ABSENT: 'Thuê bao không liên lạc được',
  NORMAL_TEMPORARY_FAILURE: 'Lỗi tạm thời',
  NORMAL_UNSPECIFIED: 'Bình thường',
};

interface CallLogDetail {
  id: string;
  callerNumber: string;
  destinationNumber: string;
  direction: 'inbound' | 'outbound';
  duration: number;
  billsec?: number;
  disposition?: string;
  hangupCause?: string;
  sipCode?: string;
  sipReason?: string;
  startTime: string;
  endTime?: string;
  answerTime?: string;
  recordingUrl?: string;
  recordingStatus?: string;
  agent?: { fullName: string };
  contact?: { id: string; fullName: string };
  campaign?: { name: string; type?: 'telesale' | 'collection' };
  dispositionCode?: { label: string };
  qaAnnotation?: { score: number; notes: string; reviewedBy: { fullName: string } };
  aiScore?: { overall?: number; summary?: string; [k: string]: unknown } | null;
  ticket?: { id: string; code: string; title: string; status: string } | null;
}

interface DispositionCode {
  id: string;
  code: string;
  label: string;
}

interface CallLogDetailContentProps {
  id: string;
  onClose?: () => void;
}

/** Key-value row with dashed divider — matches mockup 07 metadata rows */
function MetaRow({ label, value, mono = false, last = false, accent = false }: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  last?: boolean;
  accent?: boolean;
}) {
  return (
    <div className={`flex justify-between items-center py-2 ${!last ? 'border-b border-dashed border-border' : ''}`}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm ${mono ? 'font-mono' : 'font-medium'} ${accent ? 'text-primary font-semibold' : 'text-foreground'}`}>
        {value}
      </span>
    </div>
  );
}

/** Section within a card — uppercase mono header + rows */
function CardSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-3">{title}</p>
      {children}
    </div>
  );
}

/** Timeline node for the activity rail */
function TimelineNode({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  time,
  isLast = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle?: string;
  time?: string;
  isLast?: boolean;
}) {
  return (
    <div className="relative flex gap-3">
      {/* Vertical dashed connector */}
      {!isLast && (
        <div className="absolute left-[11px] top-6 bottom-0 w-px border-l border-dashed border-border" />
      )}
      {/* Node icon */}
      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${iconBg} border-2 border-background shadow-sm z-10`}>
        <Icon className={`h-3 w-3 ${iconColor}`} />
      </div>
      {/* Content */}
      <div className="flex-1 pb-6">
        <p className="text-sm font-semibold text-foreground leading-tight">{title}</p>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
        {time && <p className="font-mono text-[10px] text-muted-foreground mt-1">{time}</p>}
      </div>
    </div>
  );
}

export function CallLogDetailContent({ id, onClose }: CallLogDetailContentProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  const [pendingDisposition, setPendingDisposition] = useState<string | null>(null);

  const { data: call, isLoading } = useQuery({
    queryKey: ['call-log', id],
    queryFn: () => api.get<{ data: CallLogDetail }>(`/call-logs/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });

  const dispoCategory: 'telesale' | 'collection' | null = call?.campaign?.type ?? null;

  const { data: dispositions } = useQuery({
    queryKey: ['disposition-codes', dispoCategory],
    queryFn: () => api.get<{ data: DispositionCode[] }>(
      `/disposition-codes${dispoCategory ? `?category=${dispoCategory}` : ''}`,
    ).then((r) => r.data.data),
    enabled: !isLoading,
  });

  const dispositionMutation = useMutation({
    mutationFn: (dispositionCodeId: string) =>
      api.post(`/call-logs/${id}/disposition`, { dispositionCodeId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-log', id] });
      toast.success('Đã cập nhật kết quả cuộc gọi');
      setPendingDisposition(null);
    },
    onError: () => toast.error('Cập nhật kết quả thất bại'),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-8 space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <div className="col-span-4 space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!call) {
    return <p className="text-muted-foreground">{VI.actions.noData}</p>;
  }

  const token = getAccessToken();
  const recordingUrl = call.recordingUrl
    ? (call.recordingUrl.startsWith('http') ? call.recordingUrl : `${window.location.origin}${call.recordingUrl}`) + `?token=${token}`
    : undefined;

  const dispositionLabel = call.dispositionCode?.label ?? call.disposition;
  const sipNum = call.sipCode ? parseInt(call.sipCode, 10) : 0;
  const callStatus = sipNum >= 400
    ? (call.sipReason || `Lỗi SIP ${call.sipCode}`)
    : (HANGUP_CAUSE_VI[call.hangupCause || ''] ?? call.hangupCause);
  const isSuccess = sipNum === 200 || (!call.sipCode && call.hangupCause === 'NORMAL_CLEARING');

  const canCreateTicket = sipNum === 200 && !!user && user.role !== 'qa';

  const callerPhone = call.direction === 'inbound' ? call.callerNumber : call.destinationNumber;
  const destPhone = call.direction === 'inbound' ? call.destinationNumber : call.callerNumber;

  return (
    <div className="space-y-5">
      {/* Header — mockup 07: green check badge + mono UUID + "Chi tiết cuộc gọi" */}
      <div className="flex items-end justify-between pb-3 border-b border-dashed border-border">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 mt-0.5 shrink-0" onClick={onClose ?? (() => navigate('/call-logs'))}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-lg ${isSuccess ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <h1 className="font-mono text-lg font-bold tracking-tight text-foreground">
                {call.id}
              </h1>
            </div>
            <div className="flex items-center gap-2 pl-10">
              {callStatus && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border ${
                  isSuccess
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-muted text-muted-foreground border-border'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isSuccess ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
                  {callStatus}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {call.direction === 'inbound' ? 'Cuộc gọi đến từ:' : 'Gọi đến:'} {fmtPhone(callerPhone)}
              </span>
            </div>
          </div>
        </div>
        {canCreateTicket && (
          <Button
            className="bg-primary text-white hover:bg-primary/90 font-semibold shrink-0"
            onClick={() => setTicketDialogOpen(true)}
          >
            <FileText className="h-4 w-4 mr-1.5" />
            Tạo Ticket
          </Button>
        )}
      </div>

      <CallLogTicketDialog
        open={ticketDialogOpen}
        onClose={() => setTicketDialogOpen(false)}
        onSuccess={() => { /* list refreshes on its own */ }}
        call={ticketDialogOpen ? {
          callLogId: call.id,
          contactId: call.contact?.id ?? null,
          contactName: call.contact?.fullName ?? null,
          customerPhone: callerPhone ?? '',
          startTime: call.startTime,
        } : null}
      />

      {/* Bento grid: 8/12 left + 4/12 right rail */}
      <div className="grid grid-cols-12 gap-5">
        {/* LEFT COLUMN */}
        <div className="col-span-12 lg:col-span-8 space-y-5">
          {/* Audio player card */}
          {recordingUrl && (
            <div className="bg-card rounded-xl shadow-sm border border-border p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-dashed border-border">
                <div className="flex items-center gap-2">
                  <span className="text-primary">
                    {/* wave icon via inline SVG (no new dep) */}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12h2M6 6v12M10 9v6M14 4v16M18 8v8M22 12h-2" />
                    </svg>
                  </span>
                  <h3 className="text-sm font-semibold">Ghi âm cuộc gọi</h3>
                </div>
                <a
                  href={recordingUrl}
                  download={buildRecordingFilename(
                    call.direction,
                    call.callerNumber,
                    call.destinationNumber,
                    call.startTime,
                    call.recordingUrl,
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="Tải về">
                    <Download className="h-4 w-4" />
                  </Button>
                </a>
              </div>
              <AudioPlayer src={recordingUrl} />
            </div>
          )}

          {/* 2-column metadata cards */}
          <div className="grid grid-cols-2 gap-5">
            {/* LEFT META CARD: Caller info + Destination info */}
            <div className="bg-card rounded-xl border border-border p-5 space-y-5">
              <CardSection title="Thông tin người gọi">
                <MetaRow label="Số điện thoại (CID)" value={fmtPhone(callerPhone) || '—'} mono />
                <MetaRow label="Tên khách hàng" value={call.contact?.fullName ?? '—'} />
                <MetaRow label="Khu vực" value="—" last />
              </CardSection>
              <div className="border-t border-dashed border-border" />
              <CardSection title="Thông tin đích">
                <MetaRow label="Extension" value={destPhone || '—'} mono accent />
                <MetaRow label="Hàng đợi (Queue)" value={call.campaign?.name ?? '—'} last />
              </CardSection>
            </div>

            {/* RIGHT META CARD: Time + Technical */}
            <div className="bg-card rounded-xl border border-border p-5 space-y-5">
              <CardSection title="Thời gian">
                <MetaRow
                  label="Bắt đầu"
                  value={format(new Date(call.startTime), 'yyyy-MM-dd HH:mm:ss')}
                  mono
                />
                <MetaRow
                  label="Trả lời"
                  value={call.answerTime ? format(new Date(call.answerTime), 'yyyy-MM-dd HH:mm:ss') : '—'}
                  mono
                />
                <MetaRow
                  label="Kết thúc"
                  value={call.endTime ? format(new Date(call.endTime), 'yyyy-MM-dd HH:mm:ss') : '—'}
                  mono
                />
                <MetaRow
                  label="Thời lượng"
                  value={<span className="font-mono font-bold text-primary">{formatDuration(call.duration)}</span>}
                  last
                />
              </CardSection>
              <div className="border-t border-dashed border-border" />
              <CardSection title="Kỹ thuật">
                <MetaRow
                  label="SIP Cause Code"
                  value={
                    call.sipCode
                      ? <span className="font-mono text-[11px] bg-muted px-2 py-0.5 rounded">{call.sipCode} {call.sipReason || ''}</span>
                      : '—'
                  }
                />
                <MetaRow
                  label="Hangup Reason"
                  value={<span className="font-mono text-xs text-muted-foreground">{call.hangupCause || '—'}</span>}
                  last
                />
              </CardSection>
            </div>
          </div>

          {/* Disposition + AI score */}
          <div className="grid grid-cols-2 gap-5">
            <div className="bg-card rounded-xl border border-border p-5">
              <CardSection title={VI.callLog.disposition}>
                {dispositionLabel ? (
                  <Badge variant="outline" className="text-sm px-3 py-1 mt-2">{dispositionLabel}</Badge>
                ) : (
                  <div className="space-y-2 mt-2">
                    <Select
                      value={pendingDisposition ?? undefined}
                      onValueChange={(v: string | null) => { if (!v) return; setPendingDisposition(v); }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={VI.callBar.selectDisposition}>
                          {pendingDisposition
                            ? dispositions?.find((d) => d.id === pendingDisposition)?.label ?? pendingDisposition
                            : null}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {dispositions?.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {pendingDisposition && (
                      <Button
                        size="sm"
                        className="w-full"
                        disabled={dispositionMutation.isPending}
                        onClick={() => dispositionMutation.mutate(pendingDisposition)}
                      >
                        {dispositionMutation.isPending ? 'Đang lưu...' : VI.actions.save}
                      </Button>
                    )}
                  </div>
                )}
              </CardSection>
            </div>

            <div className="bg-card rounded-xl border border-border p-5">
              <CardSection title="Đánh giá AI">
                {call.aiScore && typeof call.aiScore.overall === 'number' ? (
                  <div className="space-y-2 mt-2">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-base px-3 py-1">{call.aiScore.overall}/100</Badge>
                      <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">do AI chấm</span>
                    </div>
                    {typeof call.aiScore.summary === 'string' && call.aiScore.summary && (
                      <p className="text-sm text-muted-foreground">{call.aiScore.summary}</p>
                    )}
                  </div>
                ) : call.qaAnnotation ? (
                  <div className="space-y-2 mt-2">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-base px-3 py-1">{call.qaAnnotation.score}/100</Badge>
                      <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                        do {call.qaAnnotation.reviewedBy.fullName} chấm
                      </span>
                    </div>
                    {call.qaAnnotation.notes && <p className="text-sm text-muted-foreground">{call.qaAnnotation.notes}</p>}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mt-2">AI đang phân tích...</p>
                )}
              </CardSection>
            </div>
          </div>
        </div>

        {/* RIGHT RAIL */}
        <div className="col-span-12 lg:col-span-4 space-y-5">
          {/* Linked ticket card */}
          <div className="bg-card rounded-xl border border-border p-5">
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-4">Ticket liên kết</p>
            {call.ticket ? (
              <div className="border border-dashed border-accent bg-accent/20 rounded-lg p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <span className="font-mono font-bold text-primary">#{call.ticket.code}</span>
                  <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded uppercase font-bold">
                    {call.ticket.status}
                  </span>
                </div>
                <p className="text-sm font-medium text-foreground">{call.ticket.title}</p>
                <div className="flex justify-end">
                  <button
                    className="text-primary text-xs font-semibold hover:underline"
                    onClick={() => navigate(`/tickets/${call.ticket!.id}`)}
                  >
                    Xem chi tiết
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Chưa có ticket liên kết</p>
            )}
          </div>

          {/* Activity timeline */}
          <div className="bg-card rounded-xl border border-border p-5">
            <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-5">Lịch sử xử lý</p>
            <div className="space-y-0">
              {call.answerTime && (
                <TimelineNode
                  icon={Phone}
                  iconBg="bg-emerald-100"
                  iconColor="text-emerald-600"
                  title="Cuộc gọi được trả lời"
                  subtitle={call.agent ? `Bởi ${call.agent.fullName}` : undefined}
                  time={format(new Date(call.answerTime), 'HH:mm:ss')}
                />
              )}
              {call.ticket && (
                <TimelineNode
                  icon={FileText}
                  iconBg="bg-accent"
                  iconColor="text-primary"
                  title="Tạo Ticket tự động"
                  subtitle="Hệ thống ghi nhận"
                  time={undefined}
                />
              )}
              {call.endTime && (
                <TimelineNode
                  icon={PhoneOff}
                  iconBg="bg-slate-100"
                  iconColor="text-slate-500"
                  title="Kết thúc cuộc gọi"
                  subtitle={call.hangupCause ? (HANGUP_CAUSE_VI[call.hangupCause] ?? call.hangupCause) : undefined}
                  time={format(new Date(call.endTime), 'HH:mm:ss')}
                />
              )}
              {call.dispositionCode && (
                <TimelineNode
                  icon={Edit2}
                  iconBg="bg-amber-100"
                  iconColor="text-amber-600"
                  title="Cập nhật Disposition"
                  subtitle={`"${call.dispositionCode.label}"`}
                  time={undefined}
                  isLast
                />
              )}
              {/* Fallback: always show at least call start */}
              {!call.answerTime && !call.endTime && (
                <TimelineNode
                  icon={Phone}
                  iconBg="bg-muted"
                  iconColor="text-muted-foreground"
                  title="Cuộc gọi bắt đầu"
                  time={format(new Date(call.startTime), 'HH:mm:ss')}
                  isLast
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CallLogDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) return <p className="text-muted-foreground">{VI.actions.noData}</p>;

  return (
    <div className="space-y-6">
      <CallLogDetailContent id={id} onClose={() => navigate('/call-logs')} />
    </div>
  );
}
