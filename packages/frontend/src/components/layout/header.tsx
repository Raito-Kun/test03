import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, LogOut, X, Plus, User, TrendingUp, FileText } from 'lucide-react';
import { AiSearchBar } from '@/components/ai/ai-search-bar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AgentStatusSelector } from '@/components/agent-status-selector';
import { NotificationBell } from '@/components/notification-bell';
import { VI } from '@/lib/vi-text';
import { useAuthStore } from '@/stores/auth-store';
import { useCustomerTabStore, type CustomerTab } from '@/stores/customer-tab-store';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onToggleAI?: () => void;
}

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
          ? 'border-[#0080ff] text-[#0080ff]'
          : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50',
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
            ? 'opacity-60 hover:opacity-100 hover:bg-slate-100'
            : 'opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-slate-200',
        )}
      >
        <X className="h-3 w-3" />
      </span>
    </button>
  );
}

export function Header({ onToggleAI }: HeaderProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const { tabs, activeTabId } = useCustomerTabStore();
  const initials = user?.fullName?.split(' ').map((n) => n[0]).join('').slice(0, 2) || '?';

  return (
    <>
      <header className="flex h-12 items-center bg-white border-b border-slate-200 px-3 sticky top-0 z-30">
        {/* Customer tabs area */}
        <div className="flex items-center flex-1 overflow-x-auto scrollbar-hide scroll-smooth h-full min-w-0">
          {tabs.map((tab) => (
            <TabItem key={tab.id} tab={tab} isActive={tab.id === activeTabId} />
          ))}

          {/* Add tab button */}
          <button
            onClick={() => navigate('/contacts')}
            className="ml-1 shrink-0 inline-flex items-center gap-1 px-2 h-7 rounded text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Thêm</span>
          </button>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-1.5 shrink-0 pl-2">
          {/* AI Assistant toggle */}
          {onToggleAI && (
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleAI}
              className="h-7 gap-1.5 bg-gradient-to-r from-blue-50 to-violet-50 border-blue-200 text-blue-700 hover:from-blue-100 hover:to-violet-100"
            >
              <Bot className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">AI</span>
            </Button>
          )}

          <AgentStatusSelector />
          <NotificationBell />

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 rounded-lg px-2 py-1 hover:bg-slate-100 transition-colors">
                <Avatar className="h-7 w-7 bg-gradient-to-br from-blue-500 to-violet-600 text-white">
                  <AvatarFallback className="text-xs bg-transparent text-white">{initials}</AvatarFallback>
                </Avatar>
                <span className="hidden md:block text-sm font-medium">{user?.fullName}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                {VI.profile}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { logout(); navigate('/login'); }}>
                <LogOut className="mr-2 h-4 w-4" />
                {VI.logout}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <AiSearchBar open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
