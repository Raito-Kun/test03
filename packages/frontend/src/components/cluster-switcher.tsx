import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Server, CheckCircle2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import api from '@/services/api-client';
import { cn } from '@/lib/utils';

interface Cluster {
  id: string;
  name: string;
  pbxIp: string;
  isActive: boolean;
  isDefault: boolean;
}

export function ClusterSwitcher() {
  const user = useAuthStore((s) => s.user);
  const [pendingCluster, setPendingCluster] = useState<Cluster | null>(null);

  const { data: clusters = [] } = useQuery<Cluster[]>({
    queryKey: ['clusters'],
    queryFn: async () => {
      const { data } = await api.get('/clusters');
      return data.data ?? [];
    },
    enabled: user?.role === 'super_admin',
  });

  const switchMutation = useMutation({
    mutationFn: (id: string) => api.post(`/clusters/${id}/switch`),
    onSuccess: () => {
      toast.success('Đã chuyển cụm thành công');
      window.location.reload();
    },
    onError: () => toast.error('Không thể chuyển cụm'),
  });

  if (user?.role !== 'super_admin' || clusters.length <= 1) return null;

  const active = clusters.find((c) => c.isActive);
  // First cluster created is considered "default"
  const isDefault = active && clusters.indexOf(active) === 0;

  const handleConfirm = () => {
    if (pendingCluster) {
      switchMutation.mutate(pendingCluster.id);
      setPendingCluster(null);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold transition-colors cursor-pointer"
            style={isDefault
              ? { background: '#0080ff', color: '#fff' }
              : { background: '#dcfce7', color: '#16a34a', border: '1px solid #86efac' }}
          >
            <Server className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline max-w-32 truncate">{active?.name ?? 'Cụm'}</span>
            <ChevronDown className="h-3 w-3 opacity-80" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <p className="px-2 py-1.5 text-xs text-muted-foreground font-medium">Chọn cụm PBX</p>
          {clusters.map((cluster) => (
            <DropdownMenuItem
              key={cluster.id}
              disabled={cluster.isActive}
              onClick={() => !cluster.isActive && setPendingCluster(cluster)}
              className={cn('flex items-center justify-between gap-2', cluster.isActive && 'bg-primary/5')}
            >
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium truncate">{cluster.name}</span>
                <span className="text-xs text-muted-foreground">{cluster.pbxIp}</span>
              </div>
              {cluster.isActive ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full shrink-0">
                  <CheckCircle2 className="h-3 w-3" /> Active
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground shrink-0">Inactive</span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={!!pendingCluster} onOpenChange={(open) => !open && setPendingCluster(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Xác nhận chuyển cụm</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Chuyển sang cụm <span className="font-semibold text-foreground">{pendingCluster?.name}</span>?
            Dữ liệu sẽ được tách biệt hoàn toàn.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setPendingCluster(null)}>
              Huỷ
            </Button>
            <Button size="sm" onClick={handleConfirm} disabled={switchMutation.isPending}>
              {switchMutation.isPending ? 'Đang chuyển...' : 'Xác nhận'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
