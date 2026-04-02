import { useState, useEffect, useRef } from 'react';
import { useCallStore } from '@/stores/call-store';
import { VI } from '@/lib/vi-text';
import { fmtPhone } from '@/lib/format';
import api from '@/services/api-client';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { Phone, PhoneOff, Pause, Play, Mic, MicOff, ArrowRightLeft, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const WRAPUP_DURATION = 30; // seconds

function formatDuration(startedAt: number): string {
  const seconds = Math.floor((Date.now() - startedAt) / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function CallBar() {
  const { activeCall, isMuted, isHeld, disposition, setMuted, setHeld, setDisposition, endCall } = useCallStore();
  const [timer, setTimer] = useState('00:00');
  const [showTransfer, setShowTransfer] = useState(false);
  const [wrapUpRemaining, setWrapUpRemaining] = useState<number | null>(null);
  const wrapUpRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: dispositionCodes } = useQuery({
    queryKey: ['disposition-codes'],
    queryFn: async () => {
      const { data } = await api.get('/disposition-codes');
      return data.data as Array<{ id: string; code: string; label: string }>;
    },
  });

  // Update timer every second
  useEffect(() => {
    if (!activeCall) return;
    const interval = setInterval(() => {
      setTimer(formatDuration(activeCall.startedAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeCall]);

  // Wrap-up timer: starts when call state is 'wrap_up'
  useEffect(() => {
    if (activeCall?.state === 'wrap_up' && wrapUpRemaining === null) {
      setWrapUpRemaining(WRAPUP_DURATION);
    }
    if (!activeCall) {
      setWrapUpRemaining(null);
      if (wrapUpRef.current) clearInterval(wrapUpRef.current);
    }
  }, [activeCall?.state, activeCall]);

  useEffect(() => {
    if (wrapUpRemaining === null) return;
    if (wrapUpRemaining <= 0) {
      endCall();
      return;
    }
    wrapUpRef.current = setInterval(() => {
      setWrapUpRemaining((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => { if (wrapUpRef.current) clearInterval(wrapUpRef.current); };
  }, [wrapUpRemaining, endCall]);

  if (!activeCall) return null;

  async function handleHangup() {
    try {
      await api.post('/calls/hangup', { callId: activeCall!.id });
    } catch { /* ignore */ }
    endCall();
  }

  async function handleHold() {
    try {
      await api.post('/calls/hold', { callId: activeCall!.id, hold: !isHeld });
      setHeld(!isHeld);
    } catch { /* ignore */ }
  }

  function handleMute() {
    setMuted(!isMuted);
  }

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-50 flex items-center gap-4 border-t bg-background px-6 py-3 shadow-lg">
        {/* Contact info */}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{activeCall.contactName}</p>
          <p className="text-xs text-muted-foreground">{fmtPhone(activeCall.phone)}</p>
        </div>

        {/* Timer + state */}
        <div className="text-center">
          <p className="font-mono text-lg font-semibold">{timer}</p>
          <p className="text-xs text-muted-foreground">
            {activeCall.direction === 'inbound' ? VI.callLog.inbound : VI.callLog.outbound}
          </p>
        </div>

        {/* Wrap-up timer */}
        {wrapUpRemaining !== null && (
          <div className="flex items-center gap-1.5 rounded-full bg-purple-100 px-3 py-1 text-purple-700">
            <Clock className="h-3.5 w-3.5 animate-pulse" />
            <span className="text-sm font-mono font-semibold">{wrapUpRemaining}s</span>
            <span className="text-xs">kết thúc</span>
            <button
              className="ml-1 text-xs underline hover:no-underline"
              onClick={() => { setWrapUpRemaining(null); endCall(); }}
            >
              Xong
            </button>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-2">
          <Button variant={isHeld ? 'default' : 'outline'} size="sm" onClick={handleHold}>
            {isHeld ? <Play className="mr-1 h-4 w-4" /> : <Pause className="mr-1 h-4 w-4" />}
            {VI.callBar.hold}
          </Button>
          <Button variant={isMuted ? 'default' : 'outline'} size="sm" onClick={handleMute}>
            {isMuted ? <MicOff className="mr-1 h-4 w-4" /> : <Mic className="mr-1 h-4 w-4" />}
            {VI.callBar.mute}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowTransfer(true)}>
            <ArrowRightLeft className="mr-1 h-4 w-4" />
            {VI.callBar.transfer}
          </Button>
          <Button variant="destructive" size="sm" onClick={handleHangup}>
            <PhoneOff className="mr-1 h-4 w-4" />
            {VI.callBar.hangup}
          </Button>
        </div>

        {/* Disposition */}
        <Select value={disposition || ''} onValueChange={(v) => setDisposition(v)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={VI.callBar.selectDisposition} />
          </SelectTrigger>
          <SelectContent>
            {(dispositionCodes || []).map((d) => (
              <SelectItem key={d.id} value={d.code}>{d.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Script */}
        {activeCall.campaignScript && (
          <div className="ml-auto max-w-xs">
            <p className="text-xs font-medium text-muted-foreground">{VI.callBar.script}</p>
            <p className="truncate text-sm">{activeCall.campaignScript}</p>
          </div>
        )}
      </div>

      {/* Transfer dialog */}
      <TransferDialog open={showTransfer} onClose={() => setShowTransfer(false)} callId={activeCall.id} />
    </>
  );
}

function TransferDialog({ open, onClose, callId }: { open: boolean; onClose: () => void; callId: string }) {
  const [target, setTarget] = useState('');
  const { data: agents } = useQuery({
    queryKey: ['agents-statuses'],
    queryFn: async () => {
      const { data } = await api.get('/agents/statuses');
      return data.data as Array<{ userId: string; fullName: string; status: string }>;
    },
    enabled: open,
  });

  async function handleTransfer() {
    try {
      await api.post('/calls/transfer', { callId, targetUserId: target });
      onClose();
    } catch { /* ignore */ }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{VI.callBar.transfer}</DialogTitle>
        </DialogHeader>
        <Select value={target} onValueChange={(v) => setTarget(v ?? '')}>
          <SelectTrigger>
            <SelectValue placeholder="Chọn nhân viên" />
          </SelectTrigger>
          <SelectContent>
            {(agents || [])
              .filter((a) => a.status === 'ready')
              .map((a) => (
                <SelectItem key={a.userId} value={a.userId}>{a.fullName}</SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Button onClick={handleTransfer} disabled={!target}>{VI.actions.confirm}</Button>
      </DialogContent>
    </Dialog>
  );
}
