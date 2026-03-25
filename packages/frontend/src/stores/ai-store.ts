import { create } from 'zustand';

interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AiStore {
  messages: AiMessage[];
  isStreaming: boolean;
  addUserMessage: (content: string) => void;
  startAssistantMessage: () => void;
  appendToAssistant: (text: string) => void;
  finishStreaming: () => void;
  clearMessages: () => void;
}

export const useAiStore = create<AiStore>((set) => ({
  messages: [],
  isStreaming: false,
  addUserMessage: (content) =>
    set((s) => ({ messages: [...s.messages, { role: 'user', content }] })),
  startAssistantMessage: () =>
    set((s) => ({
      isStreaming: true,
      messages: [...s.messages, { role: 'assistant', content: '' }],
    })),
  appendToAssistant: (text) =>
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last?.role === 'assistant') {
        msgs[msgs.length - 1] = { ...last, content: last.content + text };
      }
      return { messages: msgs };
    }),
  finishStreaming: () => set({ isStreaming: false }),
  clearMessages: () => set({ messages: [], isStreaming: false }),
}));
