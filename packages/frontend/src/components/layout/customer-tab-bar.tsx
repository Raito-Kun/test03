import { useNavigate } from 'react-router-dom';
import { X, Plus, User, TrendingUp, FileText } from 'lucide-react';
import { useCustomerTabStore, type CustomerTab } from '@/stores/customer-tab-store';

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
      className={[
        'group inline-flex items-center gap-1.5 px-3 h-8 rounded-t-md text-xs font-medium',
        'shrink-0 transition-colors relative',
        isActive
          ? 'bg-white dark:bg-slate-900 text-blue-600 border border-b-0 border-slate-200 dark:border-slate-700'
          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700',
      ].join(' ')}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span className="max-w-[120px] truncate">{tab.label}</span>
      <span
        role="button"
        onClick={handleClose}
        className={[
          'ml-0.5 rounded p-0.5 transition-colors',
          isActive
            ? 'opacity-60 hover:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-800'
            : 'opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-slate-300 dark:hover:bg-slate-600',
        ].join(' ')}
      >
        <X className="h-3 w-3" />
      </span>
    </button>
  );
}

export function CustomerTabBar() {
  const { tabs, activeTabId } = useCustomerTabStore();
  const navigate = useNavigate();

  if (tabs.length === 0) return null;

  return (
    <div className="flex h-9 items-end bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-2">
      <div className="flex items-end gap-0.5 overflow-x-auto scrollbar-hide scroll-smooth flex-1">
        {tabs.map((tab) => (
          <TabItem key={tab.id} tab={tab} isActive={tab.id === activeTabId} />
        ))}
      </div>

      {/* Add button */}
      <button
        onClick={() => navigate('/contacts')}
        className="ml-1 shrink-0 inline-flex items-center gap-1 px-2 h-7 rounded text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        <span>Thêm</span>
      </button>
    </div>
  );
}
