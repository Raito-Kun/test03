import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { User, Phone, Mail, MapPin, Clock, PhoneCall, PhoneMissed } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDuration, fmtPhone, buildRecordingFilename } from '@/lib/format';
import { WaveAudioPlayer } from '@/components/wave-audio-player';
import { getAccessToken } from '@/services/api-client';

const HANGUP_CAUSE_VI: Record<string, string> = {
  NORMAL_CLEARING: 'Thành công',
  ORIGINATOR_CANCEL: 'Hủy',
  NO_ANSWER: 'Không trả lời',
  USER_BUSY: 'Máy bận',
  CALL_REJECTED: 'Từ chối',
  UNALLOCATED_NUMBER: 'Số không tồn tại',
  RECOVERY_ON_TIMER_EXPIRE: 'Hết thời gian',
  SUBSCRIBER_ABSENT: 'Thuê bao không liên lạc được',
};

interface ContactInfo {
  id: string;
  fullName: string;
  phone: string;
  email?: string | null;
  address?: string | null;
}

interface CallLogInfo {
  id: string;
  callUuid?: string | null;
  startTime: string;
  answerTime?: string | null;
  endTime?: string | null;
  duration: number;
  billsec?: number | null;
  hangupCause?: string | null;
  sipCode?: string | null;
  recordingPath?: string | null;
  direction: 'inbound' | 'outbound';
  callerNumber: string;
  destinationNumber: string;
}

interface AgentInfo {
  fullName: string;
  extension?: string | null;
  team?: { name: string } | null;
}

interface RecentCall {
  id: string;
  startTime: string;
  duration: number;
  hangupCause?: string | null;
  direction: 'inbound' | 'outbound';
}

interface CustomerPanelProps {
  contact: ContactInfo | null;
  callLog: CallLogInfo | null;
  agent?: AgentInfo | null;
  subject: string;
  content?: string | null;
  category?: { name: string } | null;
  resultCode?: string | null;
  recentCalls?: RecentCall[];
}

/** Derive two-letter initials from full name */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function TicketDetailCustomerPanel({
  contact, callLog, agent, subject, content, category, resultCode, recentCalls,
}: CustomerPanelProps) {
  const navigate = useNavigate();
  const token = getAccessToken();
  const recordingUrl = callLog?.recordingPath
    ? `/api/v1/call-logs/${callLog.id}/recording${token ? `?token=${token}` : ''}`
    : undefined;
  const recordingFilename = callLog?.recordingPath
    ? buildRecordingFilename(
        callLog.direction,
        callLog.callerNumber,
        callLog.destinationNumber,
        callLog.startTime,
        callLog.recordingPath,
      )
    : undefined;

  return (
    <div className="space-y-5">
      {/* ── Customer card ── */}
      <div>
        <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">
          <User className="h-3.5 w-3.5" /> Khách hàng
        </p>
        {contact ? (
          <div className="rounded-xl border border-dashed border-border bg-accent/10 p-4 space-y-3">
            {/* Avatar + name row */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent border border-dashed border-border flex items-center justify-center font-bold text-sm text-primary font-mono shrink-0">
                {initials(contact.fullName)}
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">{contact.fullName}</p>
              </div>
            </div>
            {/* Contact details */}
            <div className="border-t border-dashed border-border pt-3 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="font-mono text-primary">{fmtPhone(contact.phone)}</span>
              </div>
              {contact.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="font-mono text-foreground truncate">{contact.email}</span>
                </div>
              )}
              {contact.address && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-foreground truncate">{contact.address}</span>
                </div>
              )}
            </div>
            {/* Footer link */}
            <div className="border-t border-dashed border-border pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => navigate(`/contacts/${contact.id}`)}
                className="text-xs font-bold text-primary hover:underline uppercase font-mono"
              >
                Xem hồ sơ →
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4">
            <p className="text-sm text-muted-foreground">Chưa gắn liên hệ</p>
          </div>
        )}
      </div>

      {/* ── Recent calls mini-list ── */}
      {recentCalls && recentCalls.length > 0 && (
        <div>
          <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">
            <Phone className="h-3.5 w-3.5" /> Lịch sử cuộc gọi
          </p>
          <div className="rounded-xl border border-dashed border-border overflow-hidden">
            <div className="divide-y divide-dashed divide-border">
              {recentCalls.slice(0, 3).map((rc) => {
                const isSuccess = rc.hangupCause === 'NORMAL_CLEARING';
                return (
                  <div key={rc.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isSuccess ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {isSuccess ? <PhoneCall className="h-3.5 w-3.5" /> : <PhoneMissed className="h-3.5 w-3.5" />}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">
                          {isSuccess ? 'Thành công' : (HANGUP_CAUSE_VI[rc.hangupCause || ''] ?? 'Nhỡ')}
                        </p>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          {formatDuration(rc.duration)} • {format(new Date(rc.startTime), 'dd/MM HH:mm')}
                        </p>
                      </div>
                    </div>
                    <Badge className={`text-[10px] uppercase ${isSuccess ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {isSuccess ? 'OK' : 'Nhỡ'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Linked call log ── */}
      {callLog && (
        <div>
          <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">
            <Clock className="h-3.5 w-3.5" /> Cuộc gọi gắn
          </p>
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Bắt đầu</p>
                <p className="text-xs font-mono">{format(new Date(callLog.startTime), 'HH:mm dd/MM/yyyy')}</p>
              </div>
              {callLog.endTime && (
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Kết thúc</p>
                  <p className="text-xs font-mono">{format(new Date(callLog.endTime), 'HH:mm dd/MM/yyyy')}</p>
                </div>
              )}
              <div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Thời lượng</p>
                <p className="text-xs font-mono font-bold text-primary">{formatDuration(callLog.duration)}</p>
              </div>
              {callLog.billsec != null && (
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Thời gian nói</p>
                  <p className="text-xs font-mono">{formatDuration(callLog.billsec)}</p>
                </div>
              )}
              {callLog.hangupCause && (
                <div className="col-span-2">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Kết quả</p>
                  <p className="text-xs">{HANGUP_CAUSE_VI[callLog.hangupCause] ?? callLog.hangupCause}</p>
                </div>
              )}
            </div>
            {recordingUrl && (
              <div className="border-t border-dashed border-border pt-3">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Ghi âm</p>
                <WaveAudioPlayer url={recordingUrl} height={50} downloadName={recordingFilename} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Agent + content + category + result code ── */}
      <div className="space-y-3">
        {agent && (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Nhân viên</p>
            <p className="text-sm">{`${agent.fullName}${agent.extension ? ` (ext. ${agent.extension})` : ''}${agent.team ? ` — ${agent.team.name}` : ''}`}</p>
          </div>
        )}
        {content && (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Nội dung</p>
            <p className="text-sm whitespace-pre-wrap">{content}</p>
          </div>
        )}
        {category && (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Danh mục</p>
            <p className="text-sm">{category.name}</p>
          </div>
        )}
        {resultCode && (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Mã kết quả</p>
            <p className="text-sm">{resultCode}</p>
          </div>
        )}
      </div>
    </div>
  );
}
