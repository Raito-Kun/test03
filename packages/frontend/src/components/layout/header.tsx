import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, LogOut, Search, Sun, Moon } from 'lucide-react';
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
import { useThemeStore } from '@/stores/theme-store';

interface HeaderProps {
  onToggleAI?: () => void;
}

export function Header({ onToggleAI }: HeaderProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const { theme, setTheme } = useThemeStore();
  const initials = user?.fullName?.split(' ').map((n) => n[0]).join('').slice(0, 2) || '?';

  return (
    <>
    <header className="flex h-14 items-center gap-3 border-b bg-white/80 backdrop-blur-sm px-4 sticky top-0 z-30">
      {/* Search bar */}
      <div className="relative flex-1 max-w-lg">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder={`${VI.actions.search}... (Ctrl+K)`}
          className="w-full rounded-lg border bg-slate-50 py-2 pl-9 pr-4 text-sm outline-none transition-colors focus:bg-white focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          readOnly
          onClick={() => setSearchOpen(true)}
        />
      </div>

      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {/* AI Assistant toggle */}
        {onToggleAI && (
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleAI}
            className="gap-1.5 bg-gradient-to-r from-blue-50 to-violet-50 border-blue-200 text-blue-700 hover:from-blue-100 hover:to-violet-100"
          >
            <Bot className="h-4 w-4" />
            <span className="hidden sm:inline">AI</span>
          </Button>
        )}

        <AgentStatusSelector />
        <NotificationBell />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-100 transition-colors">
              <Avatar className="h-8 w-8 bg-gradient-to-br from-blue-500 to-violet-600 text-white">
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
