import { useState } from 'react';
import { AiSearchBar } from '@/components/ai/ai-search-bar';
import { Breadcrumbs } from './breadcrumbs';
import { CustomerTabs } from './customer-tabs';
import { CommandKPill } from './command-k-pill';
import { QuickDialInline } from './quick-dial-inline';
import { TopbarActions } from './topbar-actions';

interface HeaderProps {
  onToggleAI?: () => void;
}

export function Header({ onToggleAI }: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      <header
        className="flex h-12 items-center gap-3 px-3 sticky top-0 z-30
          bg-card border-b border-border"
      >
        {/* Breadcrumb — left-anchored */}
        <Breadcrumbs />

        {/* Divider */}
        <span className="h-5 w-px bg-border shrink-0" />

        {/* Customer tabs — flex-1 scroll area */}
        <CustomerTabs />

        {/* Right cluster */}
        <CommandKPill onClick={() => setSearchOpen(true)} />
        <QuickDialInline />
        <TopbarActions onToggleAI={onToggleAI} />
      </header>

      <AiSearchBar open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
