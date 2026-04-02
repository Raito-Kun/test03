import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuthStore } from '@/stores/auth-store';
import { useSocket } from '@/hooks/use-socket';
import { ProtectedRoute } from '@/components/protected-route';
import { AppLayout } from '@/components/layout/app-layout';
import { Loader2 } from 'lucide-react';

// Lazy-load pages for code splitting
const LoginPage = lazy(() => import('@/pages/login'));
const Dashboard = lazy(() => import('@/pages/dashboard'));
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
const LiveDashboard = lazy(() => import('@/pages/monitoring/live-dashboard'));

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
              <Route path="/" element={<Dashboard />} />
              <Route path="/contacts" element={<ContactList />} />
              <Route path="/contacts/:id" element={<ContactDetail />} />
              <Route path="/leads" element={<LeadList />} />
              <Route path="/leads/:id" element={<LeadDetail />} />
              <Route path="/debt-cases" element={<DebtCaseList />} />
              <Route path="/debt-cases/:id" element={<DebtCaseDetail />} />
              <Route path="/call-logs" element={<CallLogList />} />
              <Route path="/call-logs/:id" element={<CallLogDetail />} />
              <Route path="/tickets" element={<TicketList />} />
              <Route path="/tickets/:id" element={<TicketDetail />} />
              <Route path="/campaigns" element={<CampaignList />} />
              <Route path="/campaigns/:id" element={<CampaignDetail />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/settings/permissions" element={<PermissionManager />} />
              <Route path="/settings/extensions" element={<ExtensionConfig />} />
              <Route path="/monitoring" element={<LiveDashboard />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
      <Toaster position="top-right" />
    </TooltipProvider>
  );
}

export default App;
