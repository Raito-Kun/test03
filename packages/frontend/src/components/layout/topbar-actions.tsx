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
          className="h-7 gap-1.5 bg-white/8 border-white/20 text-white/80
            hover:bg-white/15 hover:text-white"
        >
          <Bot className="h-3.5 w-3.5" />
          <span className="hidden sm:inline text-xs">AI Assist</span>
        </Button>
      )}

      {/* Dev: demo inbound call trigger */}
      <Button
        variant="ghost"
        size="sm"
        title="Demo cuộc gọi đến"
        onClick={() => showCall({ callerName: 'Nguyễn Ngọc Minh', phone: '0562717867' })}
        className="h-7 w-7 p-0 text-white/40 hover:text-green-400"
      >
        <PhoneIncoming className="h-4 w-4" />
      </Button>

      <ExtensionStatusIndicator />
      <AgentStatusSelector />
      <NotificationBell />

      {/* User avatar dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-1.5 rounded-lg px-2 py-1 hover:bg-white/10 transition-colors">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <Avatar className="h-7 w-7 bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
              <AvatarFallback className="text-xs bg-transparent text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="hidden md:block text-xs font-medium text-white/80">
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
