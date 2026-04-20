/** Static map: route pathname → Vietnamese label for breadcrumbs & status bar */
import { VI } from './vi-text';

export const ROUTE_LABELS: Record<string, string> = {
  '/': VI.nav.dashboard,
  '/contacts': VI.nav.contacts,
  '/leads': VI.nav.leads,
  '/debt-cases': VI.nav.debtCases,
  '/call-logs': VI.nav.callLogs,
  '/campaigns': VI.nav.campaigns,
  '/tickets': VI.nav.tickets,
  '/reports': VI.nav.reports,
  '/settings': VI.nav.settings,
  '/settings/extensions': 'Máy nhánh',
  '/settings/teams': 'Quản lý team',
  '/settings/clusters': 'Khai báo cụm PBX',
  '/settings/accounts': 'Quản lý tài khoản',
  '/settings/permissions': 'Phân quyền',
  '/monitoring': 'Hoạt động trong ngày',
  '/monitoring/live-calls': 'Cuộc gọi trực tiếp',
  '/monitoring/agent-status': 'Trạng thái agent',
  '/monitoring/team-stats': 'Giám sát theo team',
};

/** Returns page label for a given pathname (first match, strips trailing slash) */
export function getPageLabel(pathname: string): string {
  const clean = pathname === '/' ? '/' : pathname.replace(/\/$/, '');
  return ROUTE_LABELS[clean] ?? 'Trang';
}

/** Breadcrumb segments: [{label, path}] */
export interface BreadcrumbSegment {
  label: string;
  path: string;
}

export function getBreadcrumbs(pathname: string): BreadcrumbSegment[] {
  const segments: BreadcrumbSegment[] = [{ label: 'CRM PLS', path: '/' }];
  if (pathname === '/') {
    segments.push({ label: 'Ops', path: '/' });
    segments.push({ label: VI.nav.dashboard, path: '/' });
    return segments;
  }
  segments.push({ label: 'Ops', path: '/' });
  const label = getPageLabel(pathname);
  segments.push({ label, path: pathname });
  return segments;
}
