import { Search } from 'lucide-react';

interface CommandKPillProps {
  onClick: () => void;
}

export function CommandKPill({ onClick }: CommandKPillProps) {
  return (
    <button
      onClick={onClick}
      title="Tìm kiếm / lệnh (⌘K)"
      className="inline-flex items-center gap-2 h-7 px-3 rounded-md text-xs
        bg-muted/60 border border-border text-muted-foreground
        hover:bg-muted hover:text-foreground transition-colors shrink-0"
    >
      <Search className="h-3 w-3" />
      <span className="hidden sm:inline">Tìm kiếm</span>
      <kbd className="hidden sm:inline font-mono text-[10px] opacity-50 ml-1">⌘K</kbd>
    </button>
  );
}
