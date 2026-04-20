import { useState } from 'react';
import { Phone, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { useAgentStatusStore } from '@/stores/agent-status-store';

/** Inline quick-dial input in the topbar. Triggers POST /calls/originate. */
export function QuickDialInline() {
  const [phone, setPhone] = useState('');
  const [calling, setCalling] = useState(false);
  const user = useAuthStore((s) => s.user);
  const myStatus = useAgentStatusStore((s) => s.myStatus);

  async function handleDial() {
    const target = phone.trim();
    if (!target || calling) return;

    if (!user?.sipExtension) {
      toast.error('Tài khoản chưa được cấu hình số máy lẻ');
      return;
    }
    if (['offline', 'break'].includes(myStatus)) {
      toast.error('Chuyển sang trạng thái Sẵn sàng để gọi');
      return;
    }

    setCalling(true);
    try {
      await api.post('/calls/originate', { phone: target });
      toast.success(`Đang gọi ${target}...`);
      setPhone('');
    } catch {
      toast.error('Không thể thực hiện cuộc gọi');
    } finally {
      setCalling(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleDial();
  }

  return (
    <div className="flex items-center h-7 rounded-md border border-white/15 bg-white/8 overflow-hidden shrink-0">
      <input
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Gọi nhanh ⌘G"
        aria-label="Gọi nhanh"
        className="h-full px-2.5 text-xs bg-transparent text-white/80 placeholder:text-white/35
          outline-none w-32 min-w-0"
      />
      <button
        onClick={handleDial}
        disabled={calling || !phone.trim()}
        title="Gọi ngay"
        className="flex items-center justify-center h-full px-2 border-l border-white/15
          text-white/50 hover:text-green-400 hover:bg-white/10 transition-colors
          disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {calling
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <Phone className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
