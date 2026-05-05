import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import api from '@/services/api-client';

interface Cluster {
  id: string;
  name: string;
  isActive: boolean;
  isDefault: boolean;
}

export function ClusterBanner() {
  const user = useAuthStore((s) => s.user);

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
      toast.success('Đã chuyển về cụm mặc định');
      window.location.reload();
    },
    onError: () => toast.error('Không thể chuyển cụm'),
  });

  if (user?.role !== 'super_admin' || clusters.length <= 1) return null;

  const active = clusters.find((c) => c.isActive);
  const defaultCluster = clusters.find((c) => c.isDefault) ?? clusters[0];

  if (!active || active.isDefault) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-amber-500/90 text-amber-950 text-xs font-medium px-4 py-1.5">
      <span>Đang xem cụm: <strong>{active.name}</strong></span>
      <span className="opacity-50">·</span>
      <button
        onClick={() => switchMutation.mutate(defaultCluster.id)}
        disabled={switchMutation.isPending}
        className="underline underline-offset-2 hover:opacity-70 transition-opacity disabled:opacity-50"
      >
        {switchMutation.isPending ? 'Đang chuyển...' : 'Chuyển về mặc định'}
      </button>
    </div>
  );
}
