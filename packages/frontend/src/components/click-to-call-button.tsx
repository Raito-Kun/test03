import { useState } from 'react';
import { Phone, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import api from '@/services/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { useAgentStatusStore } from '@/stores/agent-status-store';
import { useRegistrationStatus } from '@/components/extension-status-indicator';

interface ClickToCallButtonProps {
  phone: string;
  contactName?: string;
  size?: 'default' | 'sm' | 'icon';
  variant?: 'default' | 'outline' | 'ghost';
}

/** Click-to-Call button — triggers ESL originate via backend API */
export function ClickToCallButton({ phone, contactName, size = 'default', variant = 'outline' }: ClickToCallButtonProps) {
  const [calling, setCalling] = useState(false);
  const user = useAuthStore((s) => s.user);
  const myStatus = useAgentStatusStore((s) => s.myStatus);
  const { data: regStatus } = useRegistrationStatus();

  async function handleCall() {
    if (!phone || calling) return;

    if (!user?.sipExtension) {
      toast.error('Tài khoản chưa được cấu hình số máy lẻ');
      return;
    }

    const blockedStatuses = ['offline', 'break'];
    if (blockedStatuses.includes(myStatus)) {
      toast.error('Bạn cần chuyển sang trạng thái Sẵn sàng để thực hiện cuộc gọi');
      return;
    }

    if (regStatus && !regStatus.registered) {
      toast.error(
        regStatus.eslAvailable === false
          ? 'Tổng đài không phản hồi. Vui lòng liên hệ quản trị viên.'
          : `Số máy lẻ ${user.sipExtension} chưa đăng ký trên tổng đài. Vui lòng mở softphone và đăng nhập.`,
      );
      return;
    }

    setCalling(true);
    try {
      await api.post('/calls/originate', { phone });
      toast.success(`Đang gọi ${contactName || phone}...`);
    } catch (err: unknown) {
      const axErr = err as { response?: { data?: { error?: { code?: string; message?: string } } }; message?: string };
      const errCode = axErr?.response?.data?.error?.code;
      const errMsg = axErr?.response?.data?.error?.message;

      if (errCode === 'AGENT_NOT_READY') {
        toast.error('Bạn cần chuyển sang trạng thái Sẵn sàng để thực hiện cuộc gọi');
      } else if (errCode === 'EXT_NOT_REGISTERED') {
        toast.error(errMsg || 'Số máy lẻ chưa đăng ký trên tổng đài. Vui lòng mở softphone và đăng nhập.');
      } else if (errCode === 'ESL_UNAVAILABLE') {
        toast.error(errMsg || 'Tổng đài không phản hồi. Vui lòng liên hệ quản trị viên.');
      } else {
        toast.error(errMsg || axErr?.message || 'Không thể thực hiện cuộc gọi');
      }
    } finally {
      setCalling(false);
    }
  }

  return (
    <Button variant={variant} size={size} onClick={handleCall} disabled={calling}>
      {calling ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Phone className="mr-1 h-4 w-4" />}
      Gọi
    </Button>
  );
}
