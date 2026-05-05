import { motion } from 'framer-motion';
import { Headphones, Phone, Hash, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { STATUS_META, resolveStatus, initialsOf, formatSec } from './status-meta';

export interface AgentCardData {
  id: string;
  fullName: string;
  extension: string;
  status: string;
  callDurationSec?: number;
}

interface AgentCardProps {
  agent: AgentCardData;
  onWhisper?: () => void;
  canWhisper?: boolean;
}

export function AgentCard({ agent, onWhisper, canWhisper }: AgentCardProps) {
  const s = resolveStatus(agent.status);
  const meta = STATUS_META[s];
  const Icon = meta.icon;
  const Mood = meta.moodIcon;
  // Show a generic user icon when the display name is just digits (extension-only, no real agent linked)
  const hasRealName = !/^\s*\d+\s*$/.test(agent.fullName) && agent.fullName !== `Ext ${agent.extension}`;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className={cn(
        'group relative flex flex-col items-center gap-2 rounded-md border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-lg',
        meta.dim && 'opacity-60',
      )}
    >
      <div className="relative">
        {meta.pulse && (
          <span
            className={cn(
              'absolute inset-0 -m-1.5 rounded-full ring-2 animate-ping opacity-60',
              meta.ringClass,
            )}
          />
        )}
        <div
          className={cn(
            'relative flex h-14 w-14 items-center justify-center rounded-full bg-muted text-sm font-bold text-foreground ring-[3px] ring-offset-2 ring-offset-card',
            meta.ringClass,
          )}
        >
          {hasRealName ? (
            initialsOf(agent.fullName)
          ) : (
            <UserRound className="h-7 w-7 text-muted-foreground" strokeWidth={2} />
          )}
          <span
            className={cn(
              'absolute -bottom-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-card shadow-sm',
              meta.moodBgClass,
            )}
            title={meta.label}
          >
            <Mood className="h-3 w-3" strokeWidth={2.5} />
          </span>
        </div>
      </div>

      <div className="flex w-full flex-col items-center gap-1">
        {hasRealName && (
          <p className="w-full truncate text-center text-sm font-medium text-foreground" title={agent.fullName}>
            {agent.fullName}
          </p>
        )}
        <div className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 ring-1 ring-border">
          <Hash className="h-3 w-3 text-muted-foreground" strokeWidth={2.5} />
          <span className="font-mono text-base font-bold tabular-nums tracking-tight text-foreground">
            {agent.extension}
          </span>
        </div>
        {!hasRealName && (
          <p className="text-[11px] italic text-muted-foreground">Máy nhánh</p>
        )}
      </div>

      <div
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
          meta.chipClass,
        )}
      >
        <Icon
          className={cn(
            'h-3.5 w-3.5 shrink-0',
            s === 'online' && 'fill-emerald-500 text-emerald-600 drop-shadow-[0_0_4px_rgba(16,185,129,0.7)]',
            s === 'on_call' && 'animate-pulse',
            s === 'break' && 'fill-amber-400 text-amber-600',
            s === 'offline' && 'text-muted-foreground',
          )}
          strokeWidth={2.25}
        />
        <span>{meta.label}</span>
      </div>

      {s === 'on_call' && agent.callDurationSec !== undefined && (
        <p className="flex items-center gap-1 font-mono text-xs font-semibold text-rose-600">
          <Phone className="h-3 w-3" />
          {formatSec(agent.callDurationSec)}
        </p>
      )}

      {canWhisper && s === 'on_call' && onWhisper && (
        <Button
          variant="outline"
          size="sm"
          onClick={onWhisper}
          className="absolute right-2 top-2 h-7 px-2 opacity-0 transition-opacity group-hover:opacity-100"
          title="Nghe thầm"
        >
          <Headphones className="mr-1 h-3 w-3" />
          Whisper
        </Button>
      )}
    </motion.div>
  );
}
