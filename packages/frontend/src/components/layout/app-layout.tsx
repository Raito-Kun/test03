import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { CallBar } from './call-bar';
import { OpsStatusBar } from './ops-status-bar';
import { InboundCallPopup } from '@/components/inbound-call-popup';
import { CallScriptPanel } from '@/components/call-script-panel';
import { AiAssistantPanel } from '@/components/ai/ai-assistant-panel';
import { useCallStore } from '@/stores/call-store';
import { useCustomerTabStore } from '@/stores/customer-tab-store';

// Routes that auto-open a customer tab when navigated to directly
const DETAIL_PATTERNS: { regex: RegExp; type: 'contact' | 'lead' | 'debt-case' }[] = [
  { regex: /^\/contacts\/([^/]+)$/, type: 'contact' },
  { regex: /^\/leads\/([^/]+)$/, type: 'lead' },
  { regex: /^\/debt-cases\/([^/]+)$/, type: 'debt-case' },
];

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const activeCall = useCallStore((s) => s.activeCall);
  const location = useLocation();
  const { tabs, openTab, setActiveTab } = useCustomerTabStore();

  // Sync active tab when pathname matches a known detail route
  useEffect(() => {
    for (const { regex, type } of DETAIL_PATTERNS) {
      const match = location.pathname.match(regex);
      if (match) {
        const id = match[1];
        const existing = tabs.find((t) => t.id === id);
        if (existing) {
          setActiveTab(id);
        } else {
          // Label is unknown at layout level — open with placeholder; detail pages
          // can call openTab again with the real name once data loads.
          openTab({ id, type, label: id, path: location.pathname });
        }
        return;
      }
    }
    // Not a detail route — clear active tab highlight without closing tabs
    useCustomerTabStore.setState((s) => {
      const stillOpen = s.tabs.find((t) => t.path === location.pathname);
      return { activeTabId: stillOpen ? stillOpen.id : null };
    });
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onToggleAI={() => setAiPanelOpen(!aiPanelOpen)} />
        {/* CustomerTabBar is now integrated into Header */}
        <main className={`flex-1 overflow-auto p-6 pb-10 ${activeCall ? 'pb-24' : ''}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.15, ease: 'easeOut' }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
        {activeCall && <CallBar />}
      </div>

      {/* AI Assistant Panel */}
      <AnimatePresence>
        {aiPanelOpen && <AiAssistantPanel onClose={() => setAiPanelOpen(false)} />}
      </AnimatePresence>

      <InboundCallPopup />
      <CallScriptPanel />
      <OpsStatusBar />
    </div>
  );
}
