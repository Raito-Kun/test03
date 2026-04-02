import { useNavigate } from 'react-router-dom';
import { useCustomerTabStore } from '@/stores/customer-tab-store';

type TabInput = {
  id: string;
  type: 'contact' | 'lead' | 'debt-case';
  label: string;
};

function buildPath(type: TabInput['type'], id: string): string {
  if (type === 'debt-case') return `/debt-cases/${id}`;
  return `/${type}s/${id}`;
}

export function useOpenCustomerTab() {
  const openTab = useCustomerTabStore((s) => s.openTab);
  const navigate = useNavigate();

  return (tab: TabInput) => {
    const path = buildPath(tab.type, tab.id);
    openTab({ ...tab, path });
    navigate(path);
  };
}
