import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
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
import api from '@/services/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { formatDuration } from '@/lib/format';

interface CallLogDetail {
  id: string;
  callerNumber: string;
  calleeNumber: string;
  direction: 'inbound' | 'outbound';
  duration: number;
  disposition?: string;
  startTime: string;
  endTime?: string;
  recordingUrl?: string;
  agent?: { fullName: string };
  contact?: { id: string; fullName: string };
  campaign?: { name: string };
  qaAnnotation?: { score: number; notes: string; reviewedBy: { fullName: string } };
}

interface DispositionCode {
  id: string;
  code: string;
  label: string;
}

export default function CallLogDetailPage() {
  const { id } = useParams<{ id: string }>();
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/call-logs')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            {call.direction === 'inbound' ? call.callerNumber : call.calleeNumber}
          </h1>
          <Badge variant={call.direction === 'inbound' ? 'default' : 'secondary'}>
            {call.direction === 'inbound' ? VI.callLog.inbound : VI.callLog.outbound}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Chi tiết cuộc gọi</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div><p className="text-xs text-muted-foreground">Số gọi</p><p className="font-medium">{call.callerNumber}</p></div>
            <div><p className="text-xs text-muted-foreground">Số nhận</p><p className="font-medium">{call.calleeNumber}</p></div>
            <div><p className="text-xs text-muted-foreground">{VI.callLog.duration}</p><p className="font-medium">{formatDuration(call.duration)}</p></div>
            <div><p className="text-xs text-muted-foreground">{VI.callLog.agent}</p><p className="font-medium">{call.agent?.fullName ?? '—'}</p></div>
            <div><p className="text-xs text-muted-foreground">{VI.callLog.startTime}</p><p className="font-medium">{format(new Date(call.startTime), 'dd/MM/yyyy HH:mm:ss')}</p></div>
            {call.contact && (
              <div>
                <p className="text-xs text-muted-foreground">{VI.contact.fullName}</p>
                <p className="font-medium cursor-pointer text-primary hover:underline" onClick={() => navigate(`/contacts/${call.contact!.id}`)}>
                  {call.contact.fullName}
                </p>
              </div>
            )}
            {call.campaign && (
              <div><p className="text-xs text-muted-foreground">{VI.lead.campaign}</p><p className="font-medium">{call.campaign.name}</p></div>
            )}
          </CardContent>
        </Card>

        {/* Disposition */}
        <Card>
          <CardHeader><CardTitle>{VI.callLog.disposition}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {call.disposition ? (
              <Badge variant="outline" className="text-base">{call.disposition}</Badge>
            ) : (
              <Select onValueChange={(v: string | null) => { if (v) dispositionMutation.mutate(v); }}>
                <SelectTrigger>
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
      </div>

      {/* Recording */}
      {call.recordingUrl && (
        <Card>
          <CardHeader><CardTitle>{VI.callLog.recording}</CardTitle></CardHeader>
          <CardContent>
            <AudioPlayer src={call.recordingUrl} />
          </CardContent>
        </Card>
      )}

      {/* QA Annotation */}
      <Card>
        <CardHeader><CardTitle>{VI.callLog.qa}</CardTitle></CardHeader>
        <CardContent>
          {call.qaAnnotation ? (
            <div className="space-y-2">
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="text-lg">{call.qaAnnotation.score}/100</Badge>
                <span className="text-sm text-muted-foreground">bởi {call.qaAnnotation.reviewedBy.fullName}</span>
              </div>
              {call.qaAnnotation.notes && <p className="text-sm">{call.qaAnnotation.notes}</p>}
            </div>
          ) : isQa ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Điểm (0-100)</Label>
                  <Input type="number" min={0} max={100} value={qaScore} onChange={(e) => setQaScore(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>{VI.lead.notes}</Label>
                <Textarea rows={3} value={qaNotes} onChange={(e) => setQaNotes(e.target.value)} />
              </div>
              <Button onClick={() => qaMutation.mutate()} disabled={qaMutation.isPending || !qaScore}>
                {VI.actions.save}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Chưa có đánh giá</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
