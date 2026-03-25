import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { VI } from '@/lib/vi-text';
import { useAuthStore } from '@/stores/auth-store';
import {
  LayoutDashboard, Users, Target, Landmark, PhoneCall,
  Megaphone, FileText, BarChart3, Settings, ChevronLeft, Sparkles,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const navItems = [
  { to: '/', label: VI.nav.dashboard, icon: LayoutDashboard },
  { to: '/contacts', label: VI.nav.contacts, icon: Users },
  { to: '/leads', label: VI.nav.leads, icon: Target },
  { to: '/debt-cases', label: VI.nav.debtCases, icon: Landmark },
  { to: '/call-logs', label: VI.nav.callLogs, icon: PhoneCall },
  { to: '/campaigns', label: VI.nav.campaigns, icon: Megaphone },
  { to: '/tickets', label: VI.nav.tickets, icon: FileText },
  { to: '/reports', label: VI.nav.reports, icon: BarChart3 },
  { to: '/settings', label: VI.nav.settings, icon: Settings },
];

const roleVisibility: Record<string, string[]> = {
  reports: ['admin', 'manager', 'leader', 'qa'],
};

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const role = useAuthStore((s) => s.user?.role);

  const visibleItems = navItems.filter((item) => {
    const key = item.to.replace('/', '') || 'dashboard';
    const allowed = roleVisibility[key];
    if (allowed && role && !allowed.includes(role)) return false;
    return true;
  });

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 224 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="flex flex-col bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-slate-300 shadow-xl"
    >
      {/* Logo */}
      <div className="flex h-14 items-center px-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-500/20">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-lg font-bold bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent"
            >
              CRM AI
            </motion.span>
          )}
        </div>
        <button
          onClick={onToggle}
          className={cn(
            'ml-auto flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white transition-colors',
            collapsed && 'mx-auto ml-0',
          )}
        >
          <ChevronLeft className={cn('h-4 w-4 transition-transform duration-200', collapsed && 'rotate-180')} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 p-2 pt-3">
        {visibleItems.map(({ to, label, icon: Icon }) => {
          const link = (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                  'hover:bg-slate-800/80 hover:text-white',
                  isActive
                    ? 'bg-gradient-to-r from-blue-600/20 to-violet-600/10 text-white shadow-sm'
                    : 'text-slate-400',
                  collapsed && 'justify-center px-2',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-blue-400 to-violet-500"
                      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                    />
                  )}
                  <Icon className={cn('h-4 w-4 shrink-0 transition-colors', isActive && 'text-blue-400')} />
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
        })}
      </nav>

      {/* Bottom accent */}
      <div className="p-3 border-t border-slate-800">
        <div className={cn('rounded-lg bg-slate-800/50 p-2 text-center', collapsed && 'px-1')}>
          <span className="text-[10px] text-slate-500">v1.0</span>
        </div>
      </div>
    </motion.aside>
  );
}
