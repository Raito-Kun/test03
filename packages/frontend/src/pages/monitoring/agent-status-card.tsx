/* agent-status-card v2 — M3 lavender alignment */
import type React from 'react';
import { cn } from '@/lib/utils';

export interface AgentStatus {
  id: string;
  fullName: string;
  extension: string;
  status: string;
  callDuration?: number;
  callingPhone?: string;
  teamName?: string | null;
  statusDuration?: string;
}

/** Status config aligned to M3 lavender tokens */
const STATUS_CONFIG: Record<string, {
  dotCls: string;
  pillCls: string;
  label: string;
  ringCls: string;
  dotStyle?: React.CSSProperties;
}> = {
  online:  {
    dotCls: 'bg-emerald-500',
    pillCls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-400 dark:border-emerald-800',
    label: 'Trực tuyến',
    ringCls: 'ring-2 ring-emerald-400/60',
  },
  on_call: {
    dotCls: 'bg-amber-500',
    pillCls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/25 dark:text-amber-400 dark:border-amber-800',
    label: 'Đang gọi',
    ringCls: 'ring-2 ring-amber-400/60',
  },
  break: {
    dotCls: 'bg-slate-400',
    pillCls: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-700',
    label: 'Vắng mặt',
    ringCls: 'ring-2 ring-slate-300/60',
  },
  offline: {
    dotCls: 'bg-rose-400',
    pillCls: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800',
    label: 'Offline',
    ringCls: 'ring-1 ring-border',
  },
};

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(-2).map((w) => w[0].toUpperCase()).join('');
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface Props {
  agent: AgentStatus;
}

export function AgentStatusCard({ agent }: Props) {
  const cfg = STATUS_CONFIG[agent.status] ?? STATUS_CONFIG.offline;
  const isOffline = agent.status === 'offline';
  const isOnCall = agent.status === 'on_call';

  return (
    <div className={cn(
      'flex flex-col rounded-md border border-border bg-card overflow-hidden',
      'transition-all duration-150 hover:shadow-md hover:-translate-y-0.5',
    )}>
      {/* Card header — avatar + name + ext */}
      <div className="px-3 pt-3 flex items-center gap-2.5">
        {/* Avatar */}
        <div className={cn(
          'w-9 h-9 rounded-full bg-accent text-primary flex items-center justify-center text-[11px] font-bold shrink-0',
          cfg.ringCls,
          isOffline && 'opacity-60',
        )}>
          {initials(agent.fullName)}
        </div>
        {/* Name + ext */}
        <div className="min-w-0 flex-1">
          <p className={cn('text-[13px] font-semibold truncate leading-tight', isOffline && 'text-muted-foreground')} title={agent.fullName}>
            {agent.fullName}
          </p>
          <p className="font-mono text-[10px] text-muted-foreground leading-tight">
            {agent.extension ? `Ext: ${agent.extension}` : <span className="italic">(chưa gán)</span>}
          </p>
        </div>
      </div>

      {/* Dashed divider under header */}
      <div className="border-b border-dashed border-border my-2" />

      {/* Status pill row */}
      <div className="px-3 pb-2 flex items-center justify-between gap-2">
        <span className={cn(
          'inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold px-2 py-0.5 rounded border',
          cfg.pillCls,
        )}>
          <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dotCls, isOnCall && 'animate-pulse')} />
          {cfg.label}
        </span>
        {isOnCall && agent.callDuration != null && (
          <span className="font-mono text-[10px] text-amber-600 tabular-nums animate-pulse">
            {formatDuration(agent.callDuration)}
          </span>
        )}
        {!isOnCall && agent.statusDuration && (
          <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
            {agent.statusDuration}
          </span>
        )}
      </div>

      {/* On-call phone indicator */}
      {isOnCall && agent.callingPhone && (
        <div className="px-3 pb-2 font-mono text-[10px] text-muted-foreground truncate">
          {agent.callingPhone}
        </div>
      )}
    </div>
  );
}
