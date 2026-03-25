import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { VI } from '@/lib/vi-text';
import { useAuthStore } from '@/stores/auth-store';
import {
  LayoutDashboard, Users, Target, Landmark, PhoneCall,
  Megaphone, FileText, BarChart3, Settings, ChevronLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

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

// Hide certain nav items based on role
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
    <aside
      className={cn(
        'flex flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-200',
        collapsed ? 'w-16' : 'w-56',
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center border-b px-4">
        {!collapsed && <span className="text-lg font-semibold">CRM</span>}
        <Button
          variant="ghost"
          size="icon"
          className={cn('ml-auto h-8 w-8', collapsed && 'mx-auto')}
          onClick={onToggle}
        >
          <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {visibleItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
                collapsed && 'justify-center px-2',
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
