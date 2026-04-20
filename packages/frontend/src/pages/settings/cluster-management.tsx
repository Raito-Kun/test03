import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Plus, Server, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import api from '@/services/api-client';
import ClusterDetailForm, { ClusterFormData } from './cluster-detail-form';
import { DottedCard } from '@/components/ops/dotted-card';
import { SectionHeader } from '@/components/ops/section-header';

interface ClusterSummary {
  id: string;
  name: string;
  eslHost: string;
  sipDomain: string;
  isActive: boolean;
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
        'w-full text-left transition-all hover:border-primary/60',
        selected ? 'ring-1 ring-primary' : '',
      )}
    >
      <DottedCard compact className={cn(selected ? 'bg-primary/5' : '')}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{cluster.name}</p>
            <p className="font-mono text-[10px] text-muted-foreground mt-0.5 truncate">{cluster.eslHost}</p>
            <p className="font-mono text-[10px] text-muted-foreground truncate">{cluster.sipDomain}</p>
          </div>
          <div className="flex flex-col gap-1 shrink-0 items-end">
            {cluster.isActive ? (
              <Badge className="bg-[var(--color-status-ok)]/10 text-[var(--color-status-ok)] border-[var(--color-status-ok)]/30 text-[10px]">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Active
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground text-[10px]">
                Inactive
              </Badge>
            )}
          </div>
        </div>
      </DottedCard>
    </button>
  );
}

export default function ClusterManagement() {
  const [selectedId, setSelectedId] = useState<string | 'new' | null>(null);
  const [formData, setFormData] = useState<ClusterFormData>(EMPTY_CLUSTER);

  const { data: clusters = [], isLoading } = useQuery<ClusterSummary[]>({
    queryKey: ['clusters'],
    queryFn: () => api.get('/clusters').then((r) => r.data.data ?? []),
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

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header */}
      <SectionHeader label="Khai báo cụm PBX" />

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
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground border rounded-lg">
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

          <Button variant="outline" size="sm" className="w-full" onClick={handleNewCluster}>
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
