import { create } from 'zustand';

export interface InboundCall {
  callerName: string;
  phone: string;
  callId?: string;
}

interface InboundCallStore {
  call: InboundCall | null;
  showPopup: boolean;
  showCall: (call: InboundCall) => void;
  answerCall: () => void;
  endCall: () => void;
  dismissPopup: () => void;
}

export const useInboundCallStore = create<InboundCallStore>((set) => ({
  call: null,
  showPopup: false,
  showCall: (call) => set({ call, showPopup: true }),
  answerCall: () => set({ call: null, showPopup: false }),
  endCall: () => set({ call: null, showPopup: false }),
  dismissPopup: () => set({ call: null, showPopup: false }),
}));
