import { useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { getBreadcrumbs } from '@/lib/route-labels';

export function Breadcrumbs() {
  const { pathname } = useLocation();
  const segments = getBreadcrumbs(pathname);

  return (
    <nav
      aria-label="breadcrumb"
      className="flex items-center gap-1 text-xs text-muted-foreground shrink-0"
    >
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        return (
          <span key={seg.path + i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
            <span
              className={
                isLast
                  ? 'text-foreground font-medium'
                  : 'text-muted-foreground'
              }
            >
              {seg.label}
            </span>
          </span>
        );
      })}
    </nav>
  );
}
