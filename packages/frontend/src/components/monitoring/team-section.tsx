import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Crown, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AgentCard, AgentCardData } from './agent-card';

interface TeamSectionProps {
  name: string;
  leader: string | null;
  agents: AgentCardData[];
  onWhisper: (extension: string) => void;
  canWhisper: boolean;
  muted?: boolean;
  defaultOpen?: boolean;
}

export function TeamSection({
  name,
  leader,
  agents,
  onWhisper,
  canWhisper,
  muted,
  defaultOpen = true,
}: TeamSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const total = agents.length;
  const online = agents.filter((a) => a.status !== 'offline').length;
  const pct = total > 0 ? Math.round((online / total) * 100) : 0;

  return (
    <section
      className={cn(
        'mb-4 overflow-hidden rounded-md border',
        muted ? 'border-border/60 bg-muted/40' : 'border-border bg-card shadow-sm',
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/50"
      >
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-md',
            muted ? 'bg-muted text-muted-foreground' : 'bg-accent text-accent-foreground',
          )}
        >
          <Users className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={cn(
                'truncate font-semibold',
                muted ? 'text-muted-foreground' : 'text-foreground',
              )}
            >
              {name}
            </h3>
            {leader && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/25 dark:border-amber-800 dark:text-amber-400">
                <Crown className="h-3 w-3" />
                {leader}
              </span>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-3">
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              {online} / {total} online
            </span>
          </div>
        </div>
        <ChevronDown
          className={cn(
            'h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-3 px-5 pb-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {agents.length === 0 ? (
                <p className="col-span-full py-4 text-center text-sm italic text-muted-foreground">
                  Không có nhân viên nào phù hợp.
                </p>
              ) : (
                agents.map((a) => (
                  <AgentCard
                    key={a.id}
                    agent={a}
                    canWhisper={canWhisper}
                    onWhisper={() => onWhisper(a.extension)}
                  />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
