import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Loader2 } from 'lucide-react';
import api from '@/services/api-client';
import AccountManagement from './account-management';
import { ClusterSelect } from '@/components/cluster-select';

interface ClusterSummary {
  id: string;
  name: string;
  isActive: boolean;
}

export default function AccountManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const clusterId = searchParams.get('clusterId') ?? '';

  const { data: clusters = [], isLoading } = useQuery<ClusterSummary[]>({
    queryKey: ['clusters'],
    queryFn: () => api.get('/clusters').then((r) => r.data.data ?? []),
  });

  // Default to first cluster if none selected
  const effectiveId = clusterId || clusters[0]?.id || '';
  const activeCluster = clusters.find((c) => c.id === effectiveId);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (clusters.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground text-sm">
        Chưa có cụm PBX nào. Vui lòng tạo cụm trước.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <span className="text-muted-foreground">Trang chủ</span>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">Hệ thống</span>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-primary font-semibold">Quản lý tài khoản</span>
      </nav>

      {clusters.length > 1 && (
        <ClusterSelect
          clusters={clusters}
          value={effectiveId}
          onChange={(id) => setSearchParams({ clusterId: id })}
        />
      )}

      {effectiveId && activeCluster && (
        <div className="flex-1 min-h-0">
          <AccountManagement
            clusterId={effectiveId}
            clusterName={activeCluster.name}
          />
        </div>
      )}
    </div>
  );
}
