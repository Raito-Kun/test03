import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Send, Bot, User, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAiStore } from '@/stores/ai-store';
import * as aiService from '@/services/ai-service';

interface AiAssistantPanelProps {
  onClose: () => void;
}

export function AiAssistantPanel({ onClose }: AiAssistantPanelProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { messages, isStreaming, addUserMessage, startAssistantMessage, appendToAssistant, finishStreaming } = useAiStore();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || isStreaming) return;
    const msg = input.trim();
    setInput('');
    addUserMessage(msg);
    startAssistantMessage();

    try {
      const context = `Trang hiện tại: ${window.location.pathname}`;
      for await (const chunk of aiService.chatStream(context, msg)) {
        appendToAssistant(chunk);
      }
    } catch {
      appendToAssistant('Lỗi kết nối AI.');
    }
    finishStreaming();
  }

  return (
    <motion.div
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="w-96 border-l bg-white shadow-2xl flex flex-col h-full"
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3 bg-gradient-to-r from-blue-50 to-violet-50">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">Trợ lý AI</h3>
          <p className="text-[10px] text-muted-foreground">Hỗ trợ bạn trong công việc</p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <Bot className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Xin chào! Tôi có thể giúp gì cho bạn?</p>
            <div className="mt-4 space-y-2">
              {['Tóm tắt khách hàng này', 'Gợi ý kịch bản gọi', 'Phân tích hiệu suất hôm nay'].map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); }}
                  className="block w-full rounded-lg border border-border px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600 mt-0.5">
                <Bot className="h-3 w-3 text-white" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-muted text-foreground rounded-bl-sm'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {isStreaming && i === messages.length - 1 && msg.role === 'assistant' && (
                <span className="inline-block w-1.5 h-4 bg-blue-500 animate-pulse ml-0.5" />
              )}
            </div>
            {msg.role === 'user' && (
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted mt-0.5">
                <User className="h-3 w-3 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="border-t p-3">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Nhập câu hỏi..."
            className="flex-1 rounded-lg border bg-muted px-3 py-2 text-sm outline-none focus:bg-white focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            disabled={isStreaming}
          />
          <Button type="submit" size="icon" disabled={isStreaming || !input.trim()} className="bg-blue-600 hover:bg-blue-700">
            {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </motion.div>
  );
}
