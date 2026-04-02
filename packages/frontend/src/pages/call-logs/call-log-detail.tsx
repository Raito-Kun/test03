import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AudioPlayer } from '@/components/audio-player';
import { VI } from '@/lib/vi-text';
import api, { getAccessToken } from '@/services/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { formatDuration, fmtPhone } from '@/lib/format';

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
  campaign?: { name: string };
  dispositionCode?: { label: string };
  qaAnnotation?: { score: number; notes: string; reviewedBy: { fullName: string } };
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

export function CallLogDetailContent({ id, onClose }: CallLogDetailContentProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isQa = user && ['qa', 'leader', 'manager', 'admin'].includes(user.role);

  const [qaScore, setQaScore] = useState('');
  const [qaNotes, setQaNotes] = useState('');

  const { data: call, isLoading } = useQuery({
    queryKey: ['call-log', id],
    queryFn: () => api.get<{ data: CallLogDetail }>(`/call-logs/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });

  const { data: dispositions } = useQuery({
    queryKey: ['disposition-codes'],
    queryFn: () => api.get<{ data: DispositionCode[] }>('/disposition-codes').then((r) => r.data.data),
  });

  const dispositionMutation = useMutation({
    mutationFn: (code: string) => api.post(`/call-logs/${id}/disposition`, { dispositionCode: code }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-log', id] });
      toast.success('Đã cập nhật kết quả cuộc gọi');
    },
    onError: () => toast.error('Cập nhật kết quả thất bại'),
  });

  const qaMutation = useMutation({
    mutationFn: () => api.post(`/call-logs/${id}/qa`, { score: Number(qaScore), notes: qaNotes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-log', id] });
      toast.success('Đã lưu đánh giá QA');
      setQaScore('');
      setQaNotes('');
    },
    onError: () => toast.error('Lưu đánh giá thất bại'),
  });

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!call) {
    return <p className="text-muted-foreground">{VI.actions.noData}</p>;
  }

  // Recording URL: prepend origin if relative, append token for browser media elements
  const token = getAccessToken();
  const recordingUrl = call.recordingUrl
    ? (call.recordingUrl.startsWith('http') ? call.recordingUrl : `${window.location.origin}${call.recordingUrl}`) + `?token=${token}`
    : undefined;

  // Disposition label: show Vietnamese label if available, else raw code
  const dispositionLabel = call.dispositionCode?.label ?? call.disposition;

  // Status: if SIP code >= 400, show error instead of "Thành công"
  const sipNum = call.sipCode ? parseInt(call.sipCode, 10) : 0;
  const callStatus = sipNum >= 400
    ? (call.sipReason || `Lỗi SIP ${call.sipCode}`)
    : (HANGUP_CAUSE_VI[call.hangupCause || ''] ?? call.hangupCause);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose ?? (() => navigate('/call-logs'))}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">
            {fmtPhone(call.direction === 'inbound' ? call.callerNumber : call.destinationNumber)}
          </h2>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant={call.direction === 'inbound' ? 'default' : 'secondary'} className="text-xs">
              {call.direction === 'inbound' ? VI.callLog.inbound : VI.callLog.outbound}
            </Badge>
            {callStatus && <span className="text-xs text-muted-foreground">{callStatus}</span>}
          </div>
        </div>
      </div>

      {/* 2-column layout: left = details, right = disposition + recording + QA */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[1fr_1fr]">
        {/* LEFT: Chi tiết cuộc gọi */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Chi tiết cuộc gọi</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div><p className="text-xs text-muted-foreground mb-0.5">Số gọi (Extension)</p><p className="text-sm font-medium">{fmtPhone(call.direction === 'inbound' ? call.destinationNumber : call.callerNumber)}</p></div>
              <div><p className="text-xs text-muted-foreground mb-0.5">Số nhận (Khách hàng)</p><p className="text-sm font-medium">{fmtPhone(call.direction === 'inbound' ? call.callerNumber : call.destinationNumber)}</p></div>
              <div><p className="text-xs text-muted-foreground mb-0.5">{VI.callLog.duration}</p><p className="text-sm font-medium">{formatDuration(call.duration)}</p></div>
              {call.billsec != null && (
                <div><p className="text-xs text-muted-foreground mb-0.5">Thời gian nói</p><p className="text-sm font-medium">{formatDuration(call.billsec)}</p></div>
              )}
              <div><p className="text-xs text-muted-foreground mb-0.5">{VI.callLog.agent}</p><p className="text-sm font-medium">{call.agent?.fullName ?? '—'}</p></div>
              <div><p className="text-xs text-muted-foreground mb-0.5">{VI.callLog.startTime}</p><p className="text-sm font-medium">{format(new Date(call.startTime), 'dd/MM/yyyy HH:mm:ss')}</p></div>
              {call.endTime && (
                <div><p className="text-xs text-muted-foreground mb-0.5">Kết thúc</p><p className="text-sm font-medium">{format(new Date(call.endTime), 'dd/MM/yyyy HH:mm:ss')}</p></div>
              )}
              {call.sipCode && (
                <div><p className="text-xs text-muted-foreground mb-0.5">SIP Code</p><p className="text-sm font-medium">{call.sipCode}{call.sipReason ? ` — ${call.sipReason}` : ''}</p></div>
              )}
              {call.contact && (
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">{VI.contact.fullName}</p>
                  <p className="text-sm font-medium cursor-pointer text-primary hover:underline" onClick={() => navigate(`/contacts/${call.contact!.id}`)}>
                    {call.contact.fullName}
                  </p>
                </div>
              )}
              {call.campaign && (
                <div><p className="text-xs text-muted-foreground mb-0.5">{VI.lead.campaign}</p><p className="text-sm font-medium">{call.campaign.name}</p></div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* RIGHT: Kết quả + Ghi âm + QA */}
        <div className="space-y-4">
          {/* Disposition */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">{VI.callLog.disposition}</CardTitle></CardHeader>
            <CardContent>
              {dispositionLabel ? (
                <Badge variant="outline" className="text-sm px-3 py-1">{dispositionLabel}</Badge>
              ) : (
                <Select onValueChange={(v: string | null) => { if (v) dispositionMutation.mutate(v); }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={VI.callBar.selectDisposition} />
                  </SelectTrigger>
                  <SelectContent>
                    {dispositions?.map((d) => (
                      <SelectItem key={d.id} value={d.code}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>

          {/* Recording */}
          {recordingUrl && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">{VI.callLog.recording}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <AudioPlayer src={recordingUrl} />
                <a href={recordingUrl} download>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-1.5" />
                    Tải về
                  </Button>
                </a>
              </CardContent>
            </Card>
          )}

          {/* QA Annotation */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">{VI.callLog.qa}</CardTitle></CardHeader>
            <CardContent>
              {call.qaAnnotation ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-base px-3 py-1">{call.qaAnnotation.score}/100</Badge>
                    <span className="text-xs text-muted-foreground">bởi {call.qaAnnotation.reviewedBy.fullName}</span>
                  </div>
                  {call.qaAnnotation.notes && <p className="text-sm text-muted-foreground">{call.qaAnnotation.notes}</p>}
                </div>
              ) : isQa ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Điểm (0-100)</Label>
                    <Input type="number" min={0} max={100} value={qaScore} onChange={(e) => setQaScore(e.target.value)} className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{VI.lead.notes}</Label>
                    <Textarea rows={2} value={qaNotes} onChange={(e) => setQaNotes(e.target.value)} />
                  </div>
                  <Button size="sm" onClick={() => qaMutation.mutate()} disabled={qaMutation.isPending || !qaScore}>
                    {VI.actions.save}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Chưa có đánh giá</p>
              )}
            </CardContent>
          </Card>
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
