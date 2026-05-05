import { useNavigate } from 'react-router-dom';
import { Bot, LogOut, PhoneIncoming } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AgentStatusSelector } from '@/components/agent-status-selector';
import { ExtensionStatusIndicator } from '@/components/extension-status-indicator';
import { NotificationBell } from '@/components/notification-bell';
import { ClusterSwitcher } from '@/components/cluster-switcher';
import { VI } from '@/lib/vi-text';
import { useAuthStore } from '@/stores/auth-store';
import { useInboundCallStore } from '@/stores/inbound-call-store';

interface TopbarActionsProps {
  onToggleAI?: () => void;
}

export function TopbarActions({ onToggleAI }: TopbarActionsProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const showCall = useInboundCallStore((s) => s.showCall);

  const initials =
    user?.fullName
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2) ?? '?';

  return (
    <div className="flex items-center gap-1.5 shrink-0 pl-2">
      <ClusterSwitcher />

      {onToggleAI && (
        <Button
          variant="outline"
          size="sm"
          onClick={onToggleAI}
          className="h-7 gap-1.5 bg-emerald-50 border-emerald-200 text-emerald-700
            hover:bg-emerald-100 hover:text-emerald-800
            dark:bg-emerald-900/25 dark:border-emerald-800 dark:text-emerald-400"
        >
          <Bot className="h-3.5 w-3.5" />
          <span className="hidden sm:inline text-xs font-medium">AI Assist</span>
        </Button>
      )}

      {/* Dev: demo inbound call trigger */}
      <Button
        variant="ghost"
        size="sm"
        title="Demo cuộc gọi đến"
        onClick={() => showCall({ callerName: 'Nguyễn Ngọc Minh', phone: '0562717867' })}
        className="h-7 w-7 p-0 text-muted-foreground hover:text-emerald-600"
      >
        <PhoneIncoming className="h-4 w-4" />
      </Button>

      <ExtensionStatusIndicator />
      <AgentStatusSelector />
      <NotificationBell />

      {/* User avatar dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-muted transition-colors">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <Avatar className="h-7 w-7 bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
              <AvatarFallback className="text-xs bg-transparent text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="hidden md:block text-xs font-medium text-foreground">
              {user?.fullName}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => navigate('/settings')}>
            {VI.profile}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {VI.logout}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
