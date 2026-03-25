import { create } from 'zustand';

interface CallState {
  activeCall: {
    id: string;
    contactName: string;
    phone: string;
    direction: 'inbound' | 'outbound';
    state: 'ringing' | 'answered' | 'hold' | 'wrap_up';
    startedAt: number;
    campaignScript?: string;
  } | null;
  isMuted: boolean;
  isHeld: boolean;
  disposition: string | null;
  inboundPopup: { callId: string; contactName: string; phone: string } | null;
  setActiveCall: (call: CallState['activeCall']) => void;
  setMuted: (muted: boolean) => void;
  setHeld: (held: boolean) => void;
  setDisposition: (code: string | null) => void;
  endCall: () => void;
  showInboundPopup: (popup: CallState['inboundPopup']) => void;
  dismissInboundPopup: () => void;
}

export const useCallStore = create<CallState>((set) => ({
  activeCall: null,
  isMuted: false,
  isHeld: false,
  disposition: null,
  inboundPopup: null,
  setActiveCall: (call) => set({ activeCall: call, isMuted: false, isHeld: false, disposition: null }),
  setMuted: (muted) => set({ isMuted: muted }),
  setHeld: (held) => set({ isHeld: held }),
  setDisposition: (code) => set({ disposition: code }),
  endCall: () => set({ activeCall: null, isMuted: false, isHeld: false }),
  dismissInboundPopup: () => set({ inboundPopup: null }),
  showInboundPopup: (popup) => set({ inboundPopup: popup }),
}));
