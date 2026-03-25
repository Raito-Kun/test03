import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { CallBar } from './call-bar';
import { InboundCallPopup } from '@/components/inbound-call-popup';
import { AiAssistantPanel } from '@/components/ai/ai-assistant-panel';
import { Softphone } from '@/components/softphone';
import { useCallStore } from '@/stores/call-store';

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

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onToggleAI={() => setAiPanelOpen(!aiPanelOpen)} />
        <main className={`flex-1 overflow-auto p-6 ${activeCall ? 'pb-24' : ''}`}>
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
      <Softphone />
    </div>
  );
}
