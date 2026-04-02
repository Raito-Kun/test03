import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import {
  LayoutDashboard, Users, Target, Landmark, PhoneCall,
  Megaphone, FileText, BarChart3, Settings, ChevronLeft,
  ShieldCheck, Phone, Monitor, LifeBuoy,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SidebarNavGroup, NavItem } from './sidebar-nav-group';

const STORAGE_KEY = 'crm-sidebar-groups';

const roleVisibility: Record<string, string[]> = {
  reports: ['super_admin', 'admin', 'manager', 'leader', 'qa'],
  'settings/permissions': ['super_admin', 'admin'],
  'settings/extensions': ['super_admin', 'admin'],
  monitoring: ['super_admin', 'admin', 'manager', 'leader'],
};

function canView(to: string, role: string | undefined): boolean {
  const key = to.replace(/^\//, '');
  const allowed = roleVisibility[key];
  if (allowed && role && !allowed.includes(role)) return false;
  return true;
}

const GROUP_DEFAULTS: Record<string, boolean> = {
  monitor: true,
  crm: true,
  callcenter: true,
  support: true,
};

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const role = useAuthStore((s) => s.user?.role);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...GROUP_DEFAULTS, ...JSON.parse(saved) } : { ...GROUP_DEFAULTS };
    } catch {
      return { ...GROUP_DEFAULTS };
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(openGroups));
    } catch {
      // ignore storage errors
    }
  }, [openGroups]);

  function toggleGroup(key: string) {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function filterItems(items: NavItem[]): NavItem[] {
    return items.filter((item) => canView(item.to, role));
  }

  const group1Items: NavItem[] = [
    { to: '/', label: 'Tổng quan', icon: LayoutDashboard },
    { to: '/monitoring', label: 'Hoạt động trong ngày', icon: Monitor },
  ];

  const group2Items: NavItem[] = [
    { to: '/contacts', label: 'Danh bạ', icon: Users },
    { to: '/leads', label: 'Khách hàng tiềm năng', icon: Target },
    { to: '/debt-cases', label: 'Công nợ', icon: Landmark },
    { to: '/campaigns', label: 'Chiến dịch', icon: Megaphone },
  ];

  const group3Items: NavItem[] = filterItems([
    { to: '/call-logs', label: 'Lịch sử cuộc gọi', icon: PhoneCall },
    { to: '/settings/extensions', label: 'Máy nhánh', icon: Phone },
  ]);

  const group4Items: NavItem[] = filterItems([
    { to: '/tickets', label: 'Phiếu ghi', icon: FileText },
    { to: '/reports', label: 'Báo cáo', icon: BarChart3 },
  ]);

  const bottomItems: NavItem[] = filterItems([
    { to: '/settings', label: 'Cài đặt', icon: Settings },
    { to: '/settings/permissions', label: 'Phân quyền', icon: ShieldCheck },
  ]);

  function renderBottomItem(item: NavItem) {
    const { to, label, icon: Icon } = item;
    const link = (
      <NavLink
        key={to}
        to={to}
        end={to === '/'}
        className={({ isActive }) =>
          cn(
            'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
            'hover:bg-[rgba(255,255,255,0.08)] hover:text-white',
            isActive
              ? 'bg-[rgba(0,128,255,0.2)] text-white shadow-sm'
              : 'text-[rgba(255,255,255,0.75)]',
            collapsed && 'justify-center px-2',
          )
        }
      >
        {({ isActive }) => (
          <>
            {isActive && (
              <motion.div
                layoutId="sidebar-active"
                className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[#0080ff]"
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              />
            )}
            <Icon className={cn('h-4 w-4 shrink-0 transition-colors', isActive && 'text-[#0080ff]')} />
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

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 224 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="flex flex-col bg-[#0d1b2a] text-slate-300 shadow-xl overflow-hidden"
    >
      {/* Logo */}
      <div className="flex h-14 items-center px-4 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <img src="/logo-pls.png" alt="CRM PLS" className="h-8 w-8 rounded-lg shrink-0 object-contain" />
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-lg font-bold text-white whitespace-nowrap"
            >
              CRM PLS
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

      {/* Navigation groups */}
      <nav className="flex-1 overflow-y-auto p-2 pt-3 space-y-0.5">
        <SidebarNavGroup
          groupKey="monitor"
          label="Giám sát"
          icon={Monitor}
          items={group1Items}
          collapsed={collapsed}
          isOpen={openGroups.monitor ?? true}
          onToggle={toggleGroup}
          isFirst
        />
        <SidebarNavGroup
          groupKey="crm"
          label="CRM"
          icon={Users}
          items={group2Items}
          collapsed={collapsed}
          isOpen={openGroups.crm ?? true}
          onToggle={toggleGroup}
        />
        {group3Items.length > 0 && (
          <SidebarNavGroup
            groupKey="callcenter"
            label="Tổng đài"
            icon={Phone}
            items={group3Items}
            collapsed={collapsed}
            isOpen={openGroups.callcenter ?? true}
            onToggle={toggleGroup}
          />
        )}
        {group4Items.length > 0 && (
          <SidebarNavGroup
            groupKey="support"
            label="Hỗ trợ"
            icon={LifeBuoy}
            items={group4Items}
            collapsed={collapsed}
            isOpen={openGroups.support ?? true}
            onToggle={toggleGroup}
          />
        )}
      </nav>

      {/* Bottom system section */}
      {bottomItems.length > 0 && (
        <div className="border-t border-slate-800 p-2 space-y-0.5">
          {!collapsed && (
            <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[rgba(255,255,255,0.35)]">
              Hệ thống
            </p>
          )}
          {bottomItems.map(renderBottomItem)}
        </div>
      )}

      {/* Version badge */}
      <div className="p-3 border-t border-slate-800 shrink-0">
        <div className={cn('rounded-lg bg-slate-800/50 p-2 text-center', collapsed && 'px-1')}>
          <span className="text-[10px] text-slate-500">v1.0</span>
        </div>
      </div>
    </motion.aside>
  );
}
