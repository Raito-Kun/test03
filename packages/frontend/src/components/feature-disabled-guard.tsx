import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { ShieldOff } from 'lucide-react';

interface Props {
  featureKey: string;
  children: React.ReactNode;
}

/**
 * Wraps a page/component and shows a friendly message if the feature is disabled.
 */
export function FeatureGuard({ featureKey, children }: Props) {
  const { isEnabled } = useFeatureFlags();

  if (!isEnabled(featureKey)) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <ShieldOff className="h-12 w-12 text-muted-foreground/50" />
        <div className="text-center space-y-1">
          <p className="text-lg font-medium text-foreground">Tính năng chưa được kích hoạt</p>
          <p className="text-sm">Tính năng này chưa được kích hoạt cho cụm hiện tại. Vui lòng liên hệ quản trị viên.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
