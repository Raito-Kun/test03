import { Zap, ZapOff, Radio, Moon, Smile, SmilePlus, Meh, Frown, LucideIcon } from 'lucide-react';

export type AgentStatus = 'online' | 'on_call' | 'break' | 'offline';

export interface StatusMeta {
  label: string;
  ringClass: string;
  dotClass: string;
  chipClass: string;
  icon: LucideIcon;
  moodIcon: LucideIcon;
  moodBgClass: string;
  pulse?: boolean;
  dim?: boolean;
}

export const STATUS_META: Record<AgentStatus, StatusMeta> = {
  online: {
    label: 'Sẵn sàng',
    ringClass: 'ring-emerald-500',
    dotClass: 'bg-emerald-500',
    chipClass: 'bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 border-emerald-200 shadow-[0_0_8px_rgba(16,185,129,0.3)]',
    icon: Zap,
    moodIcon: Smile,
    moodBgClass: 'bg-emerald-500 text-white',
    pulse: true,
  },
  on_call: {
    label: 'Đang gọi',
    ringClass: 'ring-rose-500',
    dotClass: 'bg-rose-500',
    chipClass: 'bg-gradient-to-r from-rose-50 to-rose-100 text-rose-700 border-rose-200 shadow-[0_0_8px_rgba(244,63,94,0.25)]',
    icon: Radio,
    moodIcon: SmilePlus,
    moodBgClass: 'bg-rose-500 text-white',
  },
  break: {
    label: 'Nghỉ',
    ringClass: 'ring-amber-500',
    dotClass: 'bg-amber-500',
    chipClass: 'bg-gradient-to-r from-amber-50 to-amber-100 text-amber-700 border-amber-200',
    icon: Moon,
    moodIcon: Meh,
    moodBgClass: 'bg-amber-500 text-white',
  },
  offline: {
    label: 'Ngoại tuyến',
    ringClass: 'ring-border',
    dotClass: 'bg-muted',
    chipClass: 'bg-muted text-muted-foreground border-border',
    icon: ZapOff,
    moodIcon: Frown,
    moodBgClass: 'bg-muted-foreground/60 text-white',
    dim: true,
  },
};

export function resolveStatus(s: string): AgentStatus {
  return (['online', 'on_call', 'break', 'offline'] as const).includes(s as AgentStatus)
    ? (s as AgentStatus)
    : 'offline';
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || '?';
}

export function formatSec(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
