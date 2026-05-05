import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import {
  LayoutDashboard, Users, Target, Landmark, PhoneCall,
  Megaphone, FileText, BarChart3, Settings,
  ShieldCheck, Phone, Monitor, LifeBuoy, Users2, Server, UserCog,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { NavLink } from 'react-router-dom';
import { SidebarNavGroup, NavItem } from './sidebar-nav-group';
import { LogoPill } from './logo-pill';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { FEATURE_ROUTE_MAP } from '@/lib/feature-flags';

const routeToPermission: Record<string, string> = {
  '/campaigns': 'campaign.manage',
  '/contacts': 'crm.contacts.view',
  '/leads': 'crm.leads.view',
  '/debt-cases': 'crm.debt.view',
  '/tickets': 'ticket.create',
  '/reports': 'report.view_own',
  '/call-logs': 'switchboard.listen_recording',
  '/settings/permissions': 'system.permissions',
  '/settings/teams': 'system.manage',
  '/settings/clusters': 'system.manage',
  '/settings/accounts': 'system.users',
};

const STORAGE_KEY = 'crm-sidebar-groups';

const roleVisibility: Record<string, string[]> = {
  '': ['super_admin', 'admin', 'manager', 'leader'],
  reports: ['super_admin', 'admin', 'manager', 'leader', 'qa'],
  settings: ['super_admin', 'admin', 'manager', 'leader'],
  'settings/permissions': ['super_admin', 'admin'],
  'settings/extensions': ['super_admin', 'admin'],
  monitoring: ['super_admin', 'admin', 'manager', 'leader'],
  'monitoring/live-calls': ['super_admin', 'admin', 'manager', 'leader'],
  'monitoring/agent-status': ['super_admin', 'admin', 'manager', 'leader'],
  'monitoring/team-stats': ['super_admin', 'admin', 'manager', 'leader'],
  'settings/teams': ['super_admin', 'admin', 'manager', 'leader'],
  'settings/clusters': ['super_admin', 'admin'],
  'settings/accounts': ['super_admin', 'admin'],
};

const routeToFeature: Record<string, string> = {};
for (const [featureKey, routes] of Object.entries(FEATURE_ROUTE_MAP)) {
  for (const route of routes) {
    routeToFeature[route] = featureKey;
  }
}

function canView(
  to: string,
  role: string | undefined,
  featureEnabled?: (key: string) => boolean,
  hasPermission?: (key: string) => boolean,
): boolean {
  const key = to.replace(/^\//, '');
  const allowed = roleVisibility[key];
  if (allowed && role && !allowed.includes(role)) return false;
  if (featureEnabled) {
    const featureKey = routeToFeature[to];
    if (featureKey && !featureEnabled(featureKey)) return false;
  }
  if (hasPermission) {
    const permKey = routeToPermission[to];
    if (permKey && !hasPermission(permKey)) return false;
  }
  return true;
}

const GROUP_DEFAULTS: Record<string, boolean> = {
  monitor: true, crm: true, campaigns: true, callcenter: true, support: true,
};

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const role = useAuthStore((s) => s.user?.role);
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const { isEnabled } = useFeatureFlags();

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...GROUP_DEFAULTS, ...JSON.parse(saved) } : { ...GROUP_DEFAULTS };
    } catch {
      return { ...GROUP_DEFAULTS };
    }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(openGroups)); } catch { /* ignore */ }
  }, [openGroups]);

  function toggleGroup(key: string) {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function filterItems(items: NavItem[]): NavItem[] {
    return items.filter((item) => canView(item.to, role, isEnabled, hasPermission));
  }

  const group1Items = filterItems([
    { to: '/', label: 'Tổng quan', icon: LayoutDashboard },
    { to: '/monitoring', label: 'Hoạt động trong ngày', icon: Monitor },
    { to: '/monitoring/live-calls', label: 'Cuộc gọi trực tiếp', icon: PhoneCall },
    { to: '/monitoring/agent-status', label: 'Trạng thái agent', icon: Users },
    { to: '/monitoring/team-stats', label: 'Giám sát theo team', icon: BarChart3 },
  ]);
  const group2Items = filterItems([
    { to: '/contacts', label: 'Danh sách khách hàng', icon: Users },
    { to: '/leads', label: 'Nhóm khách hàng', icon: Target },
    { to: '/debt-cases', label: 'Công nợ', icon: Landmark },
  ]);
  const groupCampaignItems = filterItems([
    { to: '/campaigns', label: 'Danh sách chiến dịch', icon: Megaphone },
  ]);
  const group3Items = filterItems([
    { to: '/call-logs', label: 'Lịch sử cuộc gọi', icon: PhoneCall },
    { to: '/settings/extensions', label: 'Máy nhánh', icon: Phone },
  ]);
  const group4Items = filterItems([
    { to: '/tickets', label: 'Phiếu ghi', icon: FileText },
    { to: '/reports', label: 'Báo cáo', icon: BarChart3 },
  ]);
  const bottomItems = filterItems([
    { to: '/settings/teams', label: 'Quản lý team', icon: Users2 },
    { to: '/settings/clusters', label: 'Khai báo cụm PBX', icon: Server },
    { to: '/settings/accounts', label: 'Quản lý tài khoản', icon: UserCog },
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
            'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-150',
            'hover:bg-[var(--sidebar-accent)]',
            isActive
              ? 'bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)] font-semibold'
              : 'text-[var(--sidebar-foreground)] hover:text-[var(--sidebar-accent-foreground)]',
            collapsed && 'justify-center px-2',
          )
        }
      >
        {({ isActive }) => (
          <>
            {isActive && (
              <motion.div
                layoutId="sidebar-active-bottom"
                className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[var(--sidebar-primary)]"
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              />
            )}
            <Icon className={cn('h-4 w-4 shrink-0 transition-colors', isActive && 'text-[var(--sidebar-primary)]')} />
            {!collapsed && <span>{label}</span>}
          </>
        )}
      </NavLink>
    );

    if (collapsed) {
      return (
        <Tooltip key={to} delayDuration={0}>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
      );
    }
    return link;
  }

  const ext = user?.sipExtension;
  const roleName = user?.role ?? '';

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 224 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="flex flex-col bg-[var(--sidebar)] text-[var(--sidebar-foreground)] border-r border-[var(--sidebar-border)] overflow-hidden"
    >
      {/* Logo + collapse toggle */}
      <div className="flex h-12 items-center px-3 border-b border-[var(--sidebar-border)] shrink-0">
        <LogoPill collapsed={collapsed} onToggle={onToggle} />
      </div>

      {/* Navigation groups */}
      <nav className="flex-1 overflow-y-auto p-2 pt-3 space-y-0.5" aria-label="Điều hướng chính">
        <SidebarNavGroup
          groupKey="monitor" label="GIÁM SÁT" icon={Monitor}
          items={group1Items} collapsed={collapsed}
          isOpen={openGroups.monitor ?? true} onToggle={toggleGroup} isFirst
        />
        {group2Items.length > 0 && (
          <SidebarNavGroup
            groupKey="crm" label="CRM" icon={Users}
            items={group2Items} collapsed={collapsed}
            isOpen={openGroups.crm ?? true} onToggle={toggleGroup}
          />
        )}
        {groupCampaignItems.length > 0 && (
          <SidebarNavGroup
            groupKey="campaigns" label="CHIẾN DỊCH" icon={Megaphone}
            items={groupCampaignItems} collapsed={collapsed}
            isOpen={openGroups.campaigns ?? true} onToggle={toggleGroup}
          />
        )}
        {group3Items.length > 0 && (
          <SidebarNavGroup
            groupKey="callcenter" label="TỔNG ĐÀI" icon={Phone}
            items={group3Items} collapsed={collapsed}
            isOpen={openGroups.callcenter ?? true} onToggle={toggleGroup}
          />
        )}
        {group4Items.length > 0 && (
          <SidebarNavGroup
            groupKey="support" label="HỖ TRỢ" icon={LifeBuoy}
            items={group4Items} collapsed={collapsed}
            isOpen={openGroups.support ?? true} onToggle={toggleGroup}
          />
        )}
      </nav>

      {/* System section */}
      {bottomItems.length > 0 && (
        <div className="border-t border-[var(--sidebar-border)] p-2 space-y-0.5">
          {!collapsed && (
            <p className="px-3 py-1.5 text-[10px] font-mono font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
              HỆ THỐNG
            </p>
          )}
          {bottomItems.map(renderBottomItem)}
        </div>
      )}

      {/* Footer: role · ext */}
      <div className="border-t border-[var(--sidebar-border)] px-3 py-2.5 shrink-0">
        {collapsed ? (
          <div className="flex justify-center">
            <span className="text-[10px] font-mono text-[var(--muted-foreground)] uppercase">{ext ?? '—'}</span>
          </div>
        ) : (
          <p className="text-[10px] font-mono text-[var(--muted-foreground)] truncate">
            {roleName} · {ext ? `ext.${ext}` : '—'}
          </p>
        )}
      </div>
    </motion.aside>
  );
}
