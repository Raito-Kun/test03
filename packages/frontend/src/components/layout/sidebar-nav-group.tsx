import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

interface SidebarNavGroupProps {
  groupKey: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
  collapsed: boolean;
  isOpen: boolean;
  onToggle: (key: string) => void;
  isFirst?: boolean;
}

function NavItemLink({ to, label, icon: Icon, collapsed }: NavItem & { collapsed: boolean }) {
  const link = (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
          'hover:bg-[rgba(255,255,255,0.1)] hover:text-white',
          isActive
            ? 'bg-[rgba(41,182,246,0.15)] text-white shadow-sm'
            : 'text-[rgba(255,255,255,0.8)]',
          collapsed && 'justify-center px-2',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.div
              layoutId="sidebar-active"
              className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[#29b6f6]"
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            />
          )}
          <Icon className={cn('h-4 w-4 shrink-0 transition-colors', isActive && 'text-[#29b6f6]')} />
          {!collapsed && <span>{label}</span>}
        </>
      )}
    </NavLink>
  );

  if (collapsed) {
    return (
      <Tooltip key={to} delayDuration={0}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" className="bg-slate-800 text-white border-slate-700">
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }
  return link;
}

export function SidebarNavGroup({
  groupKey,
  label,
  icon: GroupIcon,
  items,
  collapsed,
  isOpen,
  onToggle,
  isFirst = false,
}: SidebarNavGroupProps) {
  if (collapsed) {
    return (
      <div className="space-y-0.5">
        {items.map((item) => (
          <NavItemLink key={item.to} {...item} collapsed={collapsed} />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('space-y-0.5', !isFirst && 'mt-2')}>
      <button
        onClick={() => onToggle(groupKey)}
        className={cn(
          'w-full flex items-center justify-between px-3 py-1.5 rounded-md',
          'text-xs font-semibold uppercase tracking-wider text-[rgba(255,255,255,0.4)]',
          'hover:text-[rgba(255,255,255,0.8)] transition-colors cursor-pointer',
          !isFirst && 'mt-2',
        )}
      >
        <div className="flex items-center gap-2">
          <GroupIcon className="h-3.5 w-3.5" />
          <span>{label}</span>
        </div>
        <ChevronRight
          className={cn(
            'h-3 w-3 transition-transform duration-200',
            isOpen && 'rotate-90',
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key={groupKey}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="space-y-0.5">
              {items.map((item) => (
                <NavItemLink key={item.to} {...item} collapsed={collapsed} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
