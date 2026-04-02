import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { toast } from 'sonner';

export interface CustomerTab {
  id: string;
  type: 'contact' | 'lead' | 'debt-case';
  label: string;
  path: string;
}

interface CustomerTabStore {
  tabs: CustomerTab[];
  activeTabId: string | null;
  openTab: (tab: CustomerTab) => void;
  closeTab: (id: string, navigate?: (path: string) => void) => void;
  setActiveTab: (id: string) => void;
  updateTabLabel: (id: string, label: string) => void;
}

const MAX_TABS = 10;

export const useCustomerTabStore = create<CustomerTabStore>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,

      openTab: (tab) => {
        const { tabs } = get();
        const existing = tabs.find((t) => t.id === tab.id);
        if (existing) {
          set({ activeTabId: tab.id });
          return;
        }
        if (tabs.length >= MAX_TABS) {
          toast.error('Đã đạt giới hạn tab (tối đa 10 tab)');
          return;
        }
        set({ tabs: [...tabs, tab], activeTabId: tab.id });
      },

      closeTab: (id, navigate) => {
        const { tabs, activeTabId } = get();
        const idx = tabs.findIndex((t) => t.id === id);
        const newTabs = tabs.filter((t) => t.id !== id);

        let newActiveId: string | null = activeTabId;
        let navPath: string | null = null;

        if (activeTabId === id) {
          if (newTabs.length === 0) {
            newActiveId = null;
            navPath = '/';
          } else {
            const prevIdx = Math.max(0, idx - 1);
            newActiveId = newTabs[prevIdx].id;
            navPath = newTabs[prevIdx].path;
          }
        }

        set({ tabs: newTabs, activeTabId: newActiveId });

        if (navPath && navigate) {
          navigate(navPath);
        }
      },

      setActiveTab: (id) => set({ activeTabId: id }),

      updateTabLabel: (id, label) => {
        const { tabs } = get();
        set({ tabs: tabs.map((t) => (t.id === id ? { ...t, label } : t)) });
      },
    }),
    {
      name: 'crm-customer-tabs',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
