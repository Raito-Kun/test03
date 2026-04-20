import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuthStore } from '@/stores/auth-store';
import { useSocket } from '@/hooks/use-socket';
import { ProtectedRoute } from '@/components/protected-route';
import { AppLayout } from '@/components/layout/app-layout';
import { FeatureGuard } from '@/components/feature-disabled-guard';
import { RoleGuard } from '@/components/role-guard';

// Supervisor roles that can access the dashboard and system settings.
// Agents/QA land on /contacts (their primary workspace) instead.
const SUPERVISOR_ROLES = ['super_admin', 'admin', 'manager', 'leader'];
import { Loader2 } from 'lucide-react';

// Lazy-load pages for code splitting
const LoginPage = lazy(() => import('@/pages/login'));
const Dashboard = lazy(() => import('@/pages/dashboard/index'));
const ContactList = lazy(() => import('@/pages/contacts/contact-list'));
const ContactDetail = lazy(() => import('@/pages/contacts/contact-detail'));
const LeadList = lazy(() => import('@/pages/leads/lead-list'));
const LeadDetail = lazy(() => import('@/pages/leads/lead-detail'));
const DebtCaseList = lazy(() => import('@/pages/debt-cases/debt-case-list'));
const DebtCaseDetail = lazy(() => import('@/pages/debt-cases/debt-case-detail'));
const CallLogList = lazy(() => import('@/pages/call-logs/call-log-list'));
const CallLogDetail = lazy(() => import('@/pages/call-logs/call-log-detail'));
const TicketList = lazy(() => import('@/pages/tickets/ticket-list'));
const TicketDetail = lazy(() => import('@/pages/tickets/ticket-detail'));
const CampaignList = lazy(() => import('@/pages/campaigns/campaign-list'));
const CampaignDetail = lazy(() => import('@/pages/campaigns/campaign-detail'));
const ReportsPage = lazy(() => import('@/pages/reports/reports-page'));
const SettingsPage = lazy(() => import('@/pages/settings/settings-page'));
const PermissionManager = lazy(() => import('@/pages/settings/permission-manager'));
const ExtensionConfig = lazy(() => import('@/pages/settings/extension-config'));
const TeamManagement = lazy(() => import('@/pages/settings/team-management'));
const ClusterManagement = lazy(() => import('./pages/settings/cluster-management'));
const AccountManagementPage = lazy(() => import('./pages/settings/account-management-page'));
const LiveDashboard = lazy(() => import('@/pages/monitoring/live-dashboard'));
const LiveCalls = lazy(() => import('@/pages/monitoring/live-calls'));
const AgentStatusGrid = lazy(() => import('@/pages/monitoring/agent-status-grid'));
const TeamStats = lazy(() => import('@/pages/monitoring/team-stats'));

function PageLoader() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function App() {
  const bootstrap = useAuthStore((s) => s.bootstrap);

  // Bootstrap auth on page load (token refresh)
  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // Connect Socket.IO when authenticated
  useSocket();

  return (
    <TooltipProvider>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<RoleGuard allow={SUPERVISOR_ROLES}><Dashboard /></RoleGuard>} />
              <Route path="/contacts" element={<FeatureGuard featureKey="contacts"><ContactList /></FeatureGuard>} />
              <Route path="/contacts/:id" element={<FeatureGuard featureKey="contacts"><ContactDetail /></FeatureGuard>} />
              <Route path="/leads" element={<FeatureGuard featureKey="leads"><LeadList /></FeatureGuard>} />
              <Route path="/leads/:id" element={<FeatureGuard featureKey="leads"><LeadDetail /></FeatureGuard>} />
              <Route path="/debt-cases" element={<FeatureGuard featureKey="debt"><DebtCaseList /></FeatureGuard>} />
              <Route path="/debt-cases/:id" element={<FeatureGuard featureKey="debt"><DebtCaseDetail /></FeatureGuard>} />
              <Route path="/call-logs" element={<FeatureGuard featureKey="call_history"><CallLogList /></FeatureGuard>} />
              <Route path="/call-logs/:id" element={<FeatureGuard featureKey="call_history"><CallLogDetail /></FeatureGuard>} />
              <Route path="/tickets" element={<FeatureGuard featureKey="tickets"><TicketList /></FeatureGuard>} />
              <Route path="/tickets/:id" element={<FeatureGuard featureKey="tickets"><TicketDetail /></FeatureGuard>} />
              <Route path="/campaigns" element={<FeatureGuard featureKey="campaigns"><CampaignList /></FeatureGuard>} />
              <Route path="/campaigns/:id" element={<FeatureGuard featureKey="campaigns"><CampaignDetail /></FeatureGuard>} />
              <Route path="/reports" element={<FeatureGuard featureKey="reports_summary"><ReportsPage /></FeatureGuard>} />
              <Route path="/settings" element={<RoleGuard allow={SUPERVISOR_ROLES}><SettingsPage /></RoleGuard>} />
              <Route path="/settings/permissions" element={<FeatureGuard featureKey="permission_matrix"><PermissionManager /></FeatureGuard>} />
              <Route path="/settings/extensions" element={<ExtensionConfig />} />
              <Route path="/settings/teams" element={<FeatureGuard featureKey="team_management"><TeamManagement /></FeatureGuard>} />
              <Route path="/settings/clusters" element={<ClusterManagement />} />
              <Route path="/settings/accounts" element={<AccountManagementPage />} />
              <Route path="/monitoring" element={<LiveDashboard />} />
              <Route path="/monitoring/live-calls" element={<FeatureGuard featureKey="live_monitoring"><LiveCalls /></FeatureGuard>} />
              <Route path="/monitoring/agent-status" element={<FeatureGuard featureKey="live_monitoring"><AgentStatusGrid /></FeatureGuard>} />
              <Route path="/monitoring/team-stats" element={<FeatureGuard featureKey="live_monitoring"><TeamStats /></FeatureGuard>} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
      <Toaster position="top-right" />
    </TooltipProvider>
  );
}

export default App;
