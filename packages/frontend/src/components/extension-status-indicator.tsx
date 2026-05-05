import { useQuery } from '@tanstack/react-query';
import { PhoneOff } from 'lucide-react';
import api from '@/services/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';

export interface RegistrationStatus {
  extension: string | null;
  registered: boolean;
  eslAvailable: boolean;
}

export function useRegistrationStatus() {
  const user = useAuthStore((s) => s.user);
  return useQuery<RegistrationStatus>({
    queryKey: ['ext-registration', user?.id],
    queryFn: () => api.get('/calls/registration-status').then((r) => r.data.data),
    enabled: !!user?.sipExtension,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

/** Compact pill: ext number with colored dot. Hidden when user has no sipExtension. */
export function ExtensionStatusIndicator() {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading } = useRegistrationStatus();

  if (!user?.sipExtension) return null;

  const ext = user.sipExtension;
  const registered = data?.registered === true;
  const eslDown = data?.eslAvailable === false;

  const dotClass = isLoading
    ? 'bg-muted-foreground/60 animate-pulse'
    : registered
    ? 'bg-green-500'
    : 'bg-red-500';

  const label = isLoading
    ? 'Đang kiểm tra extension...'
    : registered
    ? `Extension ${ext} đã đăng ký trên tổng đài`
    : eslDown
    ? `Tổng đài không phản hồi (ext ${ext})`
    : `Extension ${ext} chưa đăng ký trên tổng đài`;

  return (
    <span
      title={label}
      className={cn(
        'inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-xs font-medium border',
        registered
          ? 'border-green-500/30 bg-green-500/10 text-green-300'
          : 'border-red-500/30 bg-red-500/10 text-red-300',
      )}
    >
      <span className={cn('h-2 w-2 rounded-full', dotClass)} />
      {!registered && <PhoneOff className="h-3 w-3" />}
      <span className="font-mono">{ext}</span>
    </span>
  );
}
