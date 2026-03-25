import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { CallBar } from './call-bar';
import { InboundCallPopup } from '@/components/inbound-call-popup';
import { useCallStore } from '@/stores/call-store';

export function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const activeCall = useCallStore((s) => s.activeCall);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className={`flex-1 overflow-auto p-6 ${activeCall ? 'pb-24' : ''}`}>
          <Outlet />
        </main>
        {activeCall && <CallBar />}
      </div>
      <InboundCallPopup />
    </div>
  );
}
