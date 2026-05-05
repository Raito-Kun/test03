import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogoPillProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function LogoPill({ collapsed, onToggle }: LogoPillProps) {
  return (
    <div className="flex items-center gap-2 shrink-0 pl-1 pr-2">
      <div className="flex items-center gap-2">
        <img
          src="/raito.png"
          alt="CRM PLS"
          className="h-7 w-7 rounded-md shrink-0 object-contain"
        />
        {!collapsed && (
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold text-[var(--sidebar-primary)] whitespace-nowrap tracking-tight">
              CRM Ops
            </span>
            <span className="text-[9px] text-[var(--muted-foreground)] font-mono tracking-wider">
              v{import.meta.env.VITE_APP_VERSION ?? '1.0.0'}
            </span>
          </div>
        )}
      </div>
      <button
        onClick={onToggle}
        title={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded-md',
          'text-[var(--muted-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)] transition-colors',
          collapsed && 'ml-0',
        )}
      >
        <ChevronLeft
          className={cn(
            'h-3.5 w-3.5 transition-transform duration-200',
            collapsed && 'rotate-180',
          )}
        />
      </button>
    </div>
  );
}
