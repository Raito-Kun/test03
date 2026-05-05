import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface PageWrapperProps {
  title: string;
  children: React.ReactNode;
  createLabel?: string;
  onCreate?: () => void;
  actions?: React.ReactNode;
}

export function PageWrapper({ title, children, createLabel, onCreate, actions }: PageWrapperProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground mb-0">{title}</h1>
        <div className="flex items-center gap-2">
          {actions}
          {onCreate && (
            <Button onClick={onCreate}>
              <Plus className="mr-1 h-4 w-4" />
              {createLabel || 'Tạo mới'}
            </Button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
