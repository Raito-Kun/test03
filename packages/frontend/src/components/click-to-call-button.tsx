import { useState } from 'react';
import { Phone, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import api from '@/services/api-client';

interface ClickToCallButtonProps {
  phone: string;
  contactName?: string;
  size?: 'default' | 'sm' | 'icon';
  variant?: 'default' | 'outline' | 'ghost';
}

/** Click-to-Call button — triggers ESL originate via backend API */
export function ClickToCallButton({ phone, contactName, size = 'default', variant = 'outline' }: ClickToCallButtonProps) {
  const [calling, setCalling] = useState(false);

  async function handleCall() {
    if (!phone || calling) return;
    setCalling(true);
    try {
      await api.post('/calls/originate', { phone });
      toast.success(`Đang gọi ${contactName || phone}...`);
    } catch {
      toast.error('Không thể thực hiện cuộc gọi');
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
