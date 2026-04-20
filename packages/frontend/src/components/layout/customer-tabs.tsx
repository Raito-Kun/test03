import { useNavigate } from 'react-router-dom';
import { X, Plus, User, TrendingUp, FileText } from 'lucide-react';
import { useCustomerTabStore, type CustomerTab } from '@/stores/customer-tab-store';
import { cn } from '@/lib/utils';

const typeIcon = {
  contact: User,
  lead: TrendingUp,
  'debt-case': FileText,
} as const;

function TabItem({ tab, isActive }: { tab: CustomerTab; isActive: boolean }) {
  const { setActiveTab, closeTab } = useCustomerTabStore();
  const navigate = useNavigate();
  const Icon = typeIcon[tab.type];

  const handleClick = () => {
    setActiveTab(tab.id);
    navigate(tab.path);
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    closeTab(tab.id, navigate);
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'group inline-flex items-center gap-1.5 px-3 h-full text-xs font-medium border-b-2 transition-colors shrink-0',
        isActive
          ? 'border-[var(--color-violet-soft)] text-[var(--color-violet-soft)]'
          : 'border-transparent text-white/60 hover:text-white hover:bg-white/10',
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="max-w-[120px] truncate">{tab.label}</span>
      <span
        role="button"
        onClick={handleClose}
        className={cn(
          'ml-1 rounded p-0.5 transition-colors',
          isActive
            ? 'opacity-60 hover:opacity-100 hover:bg-white/15'
            : 'opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-white/15',
        )}
      >
        <X className="h-3 w-3" />
      </span>
    </button>
  );
}

export function CustomerTabs() {
  const { tabs, activeTabId } = useCustomerTabStore();
  const navigate = useNavigate();

  return (
    <div className="flex items-center flex-1 overflow-x-auto scrollbar-hide scroll-smooth h-full min-w-0">
      {tabs.map((tab) => (
        <TabItem key={tab.id} tab={tab} isActive={tab.id === activeTabId} />
      ))}
      <button
        onClick={() => navigate('/contacts')}
        className="ml-1 shrink-0 inline-flex items-center gap-1 px-2 h-7 rounded text-xs text-white/50 hover:text-white hover:bg-white/10 transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        <span>Thêm</span>
      </button>
    </div>
  );
}
