import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Plus, Server, AlertCircle, ChevronRight, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import api from '@/services/api-client';
import ClusterDetailForm, { ClusterFormData } from './cluster-detail-form';
import { DottedCard } from '@/components/ops/dotted-card';

interface ClusterSummary {
  id: string;
  name: string;
  eslHost: string;
  sipDomain: string;
  isActive: boolean;
  extSyncStatus?: 'idle' | 'syncing' | 'done' | 'failed';
  extSyncError?: string | null;
  extSyncCount?: number | null;
}

const EMPTY_CLUSTER: ClusterFormData = {
  name: '',
  eslHost: '',
  eslPort: 8021,
  eslPassword: '',
  sipDomain: '',
  sipWssUrl: '',
  pbxIp: '',
  gatewayName: '',
  recordingPath: '',
  recordingUrlPrefix: '',
  cdrReportUrl: '',
  aiApiEndpoint: '',
  aiApiKey: '',
  smtpHost: '',
  smtpPort: 587,
  smtpUser: '',
  smtpPassword: '',
  smtpFrom: '',
  sshUser: 'root',
  sshPassword: '',
  fusionpbxPgHost: '',
  fusionpbxPgPort: 5432,
  fusionpbxPgUser: '',
  fusionpbxPgPassword: '',
  fusionpbxPgDatabase: 'fusionpbx',
  outboundDialplanNames: [],
  isActive: false,
};

function ClusterCard({
  cluster,
  selected,
  onClick,
}: {
  cluster: ClusterSummary;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left transition-all rounded-sm',
        'bg-card border border-dashed border-border',
        'hover:shadow-md hover:-translate-y-px',
        selected ? 'ring-2 ring-primary bg-primary/5' : '',
      )}
    >
      {/* Card header with dashed bottom */}
      <div className="px-3 py-2 border-b border-dashed border-border flex items-center gap-2">
        <Server className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="font-semibold text-sm truncate flex-1">{cluster.name}</span>
        {cluster.isActive ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded-full">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
            Inactive
          </span>
        )}
      </div>
      {/* Card body */}
      <div className="px-3 py-2 space-y-0.5">
        <p className="font-mono text-[10px] text-muted-foreground truncate">{cluster.eslHost}</p>
        <p className="font-mono text-[10px] text-primary/70 truncate">{cluster.sipDomain}</p>
        <div className="flex gap-1 mt-1 flex-wrap">
          {cluster.extSyncStatus === 'syncing' && (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Đang sync ext...
            </Badge>
          )}
          {cluster.extSyncStatus === 'done' && typeof cluster.extSyncCount === 'number' && (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              {cluster.extSyncCount} ext
            </Badge>
          )}
          {cluster.extSyncStatus === 'failed' && (
            <Badge
              variant="outline"
              title={cluster.extSyncError ?? 'Sync lỗi'}
              className="text-[10px] text-[var(--color-status-danger)] border-[var(--color-status-danger)]/40"
            >
              <AlertCircle className="h-3 w-3 mr-1" />
              Sync lỗi
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}

export default function ClusterManagement() {
  const [selectedId, setSelectedId] = useState<string | 'new' | null>(null);
  const [formData, setFormData] = useState<ClusterFormData>(EMPTY_CLUSTER);

  const { data: clusters = [], isLoading } = useQuery<ClusterSummary[]>({
    queryKey: ['clusters'],
    queryFn: () => api.get('/clusters').then((r) => r.data.data ?? []),
    // Poll every 2s while any cluster is mid-sync so the badge updates without manual refresh.
    refetchInterval: (query) => {
      const data = query.state.data as ClusterSummary[] | undefined;
      return data?.some((c) => c.extSyncStatus === 'syncing') ? 2000 : false;
    },
  });

  const { data: clusterDetail, isLoading: isLoadingDetail } = useQuery<ClusterFormData>({
    queryKey: ['clusters', selectedId],
    queryFn: () => api.get(`/clusters/${selectedId}`).then((r) => r.data.data as ClusterFormData),
    enabled: !!selectedId && selectedId !== 'new',
  });

  useEffect(() => {
    if (clusterDetail) setFormData(clusterDetail);
  }, [clusterDetail]);

  function handleSelectCluster(cluster: ClusterSummary) {
    setSelectedId(cluster.id);
  }

  function handleNewCluster() {
    setSelectedId('new');
    setFormData({ ...EMPTY_CLUSTER });
  }

  function handleSaved() {
    // After save, if new → detail will refetch via invalidation
  }

  function handleDeleted() {
    setSelectedId(null);
  }

  const showDetail = selectedId !== null;
  const isLoadingForm = selectedId && selectedId !== 'new' && isLoadingDetail && !clusterDetail;

  // Derive sync info from the list (which already polls while syncing) so we
  // don't need a second polling query on the detail endpoint.
  const selectedSummary = selectedId && selectedId !== 'new'
    ? clusters.find((c) => c.id === selectedId)
    : undefined;
  const syncInfo = selectedSummary
    ? {
        status: selectedSummary.extSyncStatus,
        error: selectedSummary.extSyncError ?? null,
        count: selectedSummary.extSyncCount ?? null,
      }
    : undefined;

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Settings className="h-3.5 w-3.5 text-muted-foreground" />
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">Cài đặt</span>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-primary font-semibold">Khai báo cụm PBX</span>
      </nav>

      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Khai báo cụm PBX</h1>
        <p className="text-sm text-muted-foreground mt-1">Quản lý và cấu hình các cụm FusionPBX/FreeSWITCH</p>
      </div>

      <div className="border-b border-dashed border-border" />

      {/* Split view */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left: cluster list */}
        <div className="w-[35%] flex flex-col gap-3">
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {isLoading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : clusters.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground border border-dashed border-border rounded-sm">
                Chưa có cụm nào
              </div>
            ) : (
              clusters.map((c) => (
                <ClusterCard
                  key={c.id}
                  cluster={c}
                  selected={selectedId === c.id}
                  onClick={() => handleSelectCluster(c)}
                />
              ))
            )}
          </div>

          <Button variant="outline" size="sm" className="w-full border-dashed" onClick={handleNewCluster}>
            <Plus className="h-4 w-4 mr-2" />
            Tạo cụm mới
          </Button>
        </div>

        {/* Right: detail form */}
        <div className="flex-1 border-dotted-2 rounded-sm p-4 overflow-hidden flex flex-col">
          {!showDetail ? (
            <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
              Chọn một cụm để xem chi tiết hoặc tạo cụm mới
            </div>
          ) : isLoadingForm ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ClusterDetailForm
              cluster={formData}
              syncInfo={syncInfo}
              onChange={setFormData}
              onSaved={handleSaved}
              onDeleted={handleDeleted}
              onCancel={() => {
                if (selectedId === 'new') {
                  setSelectedId(null);
                } else if (clusterDetail) {
                  setFormData(clusterDetail);
                }
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
