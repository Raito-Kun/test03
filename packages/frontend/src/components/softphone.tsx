import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Mic, MicOff, Pause, Play, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/auth-store';
import { useCallStore } from '@/stores/call-store';
import * as sipClient from '@/lib/sip-client';
import api from '@/services/api-client';

const DTMF_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

export function Softphone() {
  const user = useAuthStore((s) => s.user);
  const { activeCall, setActiveCall, endCall, isMuted, setMuted, isHeld, setHeld } = useCallStore();
  const [registered, setRegistered] = useState(false);
  const [showDialpad, setShowDialpad] = useState(false);
  const [dialNumber, setDialNumber] = useState('');
  const [callDuration, setCallDuration] = useState(0);

  // Initialize SIP on mount
  useEffect(() => {
    const sipServer = import.meta.env.VITE_SIP_WSS_URL;
    const sipDomain = import.meta.env.VITE_SIP_DOMAIN;
    if (!sipServer || !sipDomain || !user?.sipExtension) return;

    sipClient.initSip(
      {
        server: sipServer,
        extension: user.sipExtension,
        password: import.meta.env.VITE_SIP_PASSWORD || '',
        domain: sipDomain,
      },
      {
        onRegistered: () => setRegistered(true),
        onUnregistered: () => setRegistered(false),
        onIncomingCall: (caller) => {
          setActiveCall({ id: Date.now().toString(), phone: caller, direction: 'inbound', contactName: caller, state: 'ringing', startedAt: Date.now() });
        },
        onCallEstablished: () => setCallDuration(0),
        onCallEnded: () => { endCall(); setCallDuration(0); },
      },
    );

    return () => sipClient.disconnectSip();
  }, [user?.sipExtension]);

  // Call duration timer
  useEffect(() => {
    if (!activeCall) return;
    const interval = setInterval(() => setCallDuration((d) => d + 1), 1000);
    return () => clearInterval(interval);
  }, [activeCall]);

  function handleDial() {
    if (!dialNumber.trim()) return;
    const sipDomain = import.meta.env.VITE_SIP_DOMAIN || '';
    sipClient.makeCall(dialNumber, sipDomain);
    setActiveCall({ id: Date.now().toString(), phone: dialNumber, direction: 'outbound', contactName: '', state: 'ringing', startedAt: Date.now() });
    setDialNumber('');
    setShowDialpad(false);
  }

  function handleHangup() {
    // Log call to backend before ending
    if (activeCall) {
      api.post('/call-logs/manual', {
        direction: activeCall.direction,
        callerNumber: activeCall.direction === 'outbound' ? (user?.sipExtension || '') : activeCall.phone,
        destinationNumber: activeCall.direction === 'outbound' ? activeCall.phone : (user?.sipExtension || ''),
        duration: callDuration,
        startTime: new Date(activeCall.startedAt).toISOString(),
      }).catch(() => {}); // Best-effort logging
    }
    sipClient.hangupCall();
    endCall();
  }

  function handleAnswer() {
    sipClient.answerCall();
  }

  function formatDuration(s: number): string {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  }

  if (!registered && !activeCall) return null;

  return (
    <>
      {/* Registration badge */}
      {registered && !activeCall && (
        <div className="fixed bottom-4 right-4 z-40">
          <Button
            onClick={() => setShowDialpad(!showDialpad)}
            className="h-12 w-12 rounded-full bg-emerald-600 hover:bg-emerald-700 shadow-lg"
          >
            <Phone className="h-5 w-5" />
          </Button>
        </div>
      )}

      {/* Dialpad */}
      <AnimatePresence>
        {showDialpad && !activeCall && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-20 right-4 z-40 w-64 rounded-xl bg-white shadow-2xl border p-4"
          >
            <input
              value={dialNumber}
              onChange={(e) => setDialNumber(e.target.value)}
              placeholder="Nhập số điện thoại"
              className="w-full text-center text-lg font-mono mb-3 border rounded-lg py-2 outline-none focus:border-blue-400"
            />
            <div className="grid grid-cols-3 gap-1.5 mb-3">
              {DTMF_KEYS.map((key) => (
                <button
                  key={key}
                  onClick={() => setDialNumber((n) => n + key)}
                  className="h-10 rounded-lg bg-slate-100 text-lg font-medium hover:bg-slate-200 transition-colors"
                >
                  {key}
                </button>
              ))}
            </div>
            <Button onClick={handleDial} disabled={!dialNumber.trim()} className="w-full bg-emerald-600 hover:bg-emerald-700">
              <Phone className="mr-2 h-4 w-4" /> Gọi
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active call controls */}
      {activeCall && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900 text-white p-4"
        >
          <div className="flex items-center justify-between max-w-3xl mx-auto">
            <div>
              <p className="font-medium">{activeCall.contactName || activeCall.phone}</p>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-emerald-400 border-emerald-400">
                  {activeCall.direction === 'inbound' ? 'Gọi vào' : 'Gọi ra'}
                </Badge>
                <span className="text-sm font-mono text-slate-400">{formatDuration(callDuration)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className={isMuted ? 'text-red-400' : 'text-white'}
                onClick={() => { sipClient.toggleMute(!isMuted); setMuted(!isMuted); }}
              >
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={isHeld ? 'text-amber-400' : 'text-white'}
                onClick={() => { sipClient.toggleHold(!isHeld); setHeld(!isHeld); }}
              >
                {isHeld ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDialpad(!showDialpad)}
                className="text-white"
              >
                <Keyboard className="h-5 w-5" />
              </Button>
              {activeCall.direction === 'inbound' && callDuration === 0 && (
                <Button onClick={handleAnswer} className="bg-emerald-600 hover:bg-emerald-700">
                  <Phone className="mr-1 h-4 w-4" /> Nghe
                </Button>
              )}
              <Button onClick={handleHangup} className="bg-red-600 hover:bg-red-700">
                <PhoneOff className="mr-1 h-4 w-4" /> Kết thúc
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </>
  );
}
