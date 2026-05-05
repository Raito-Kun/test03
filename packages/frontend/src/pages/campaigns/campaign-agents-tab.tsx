import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { UserPlus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { VI } from '@/lib/vi-text';
import api from '@/services/api-client';

interface Agent {
  assignedAt: string;
  user: { id: string; fullName: string; email: string; role: string; sipExtension?: string | null };
}

interface UserOption {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

interface Props {
  campaignId: string;
  agents: Agent[];
}

export function CampaignAgentsTab({ campaignId, agents }: Props) {
  const queryClient = useQueryClient();
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState('');

  const { data: users } = useQuery({
    queryKey: ['users-for-campaign'],
    queryFn: () => api.get<{ data: { items: UserOption[] } }>('/users?limit=100').then((r) => r.data.data),
    enabled: showPicker,
  });

  const addMutation = useMutation({
    mutationFn: (userId: string) => api.post(`/campaigns/${campaignId}/agents`, { userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] });
      toast.success('Đã thêm chuyên viên');
      setShowPicker(false);
    },
    onError: () => toast.error('Thêm chuyên viên thất bại'),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/campaigns/${campaignId}/agents/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] });
      toast.success('Đã xóa chuyên viên');
    },
    onError: () => toast.error('Xóa chuyên viên thất bại'),
  });

  const assignedIds = new Set(agents.map((a) => a.user.id));
  const availableUsers = (users?.items ?? []).filter(
    (u) => !assignedIds.has(u.id) && u.fullName.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{VI.campaign.agentList} ({agents.length})</h3>
        <Button size="sm" variant="outline" onClick={() => setShowPicker(!showPicker)}>
          <UserPlus className="h-3.5 w-3.5 mr-1" /> {VI.campaign.addAgent}
        </Button>
      </div>

      {showPicker && (
        <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
          <Input placeholder="Tìm chuyên viên..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8" />
          {!users ? <Skeleton className="h-20 w-full" /> : (
            <div className="max-h-40 overflow-y-auto space-y-1">
              {availableUsers.length === 0 && <p className="text-xs text-muted-foreground py-2 text-center">Không tìm thấy</p>}
              {availableUsers.map((u) => (
                <button key={u.id} onClick={() => addMutation.mutate(u.id)}
                  className="flex items-center justify-between w-full px-2 py-1.5 text-sm rounded hover:bg-background"
                  disabled={addMutation.isPending}
                >
                  <span>{u.fullName} <span className="text-muted-foreground">({u.email})</span></span>
                  {addMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Họ tên</th>
              <th className="text-left px-3 py-2 font-medium">Vai trò</th>
              <th className="text-left px-3 py-2 font-medium">Ext</th>
              <th className="text-left px-3 py-2 font-medium">Ngày gán</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {agents.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Chưa có chuyên viên</td></tr>
            ) : (
              agents.map(({ user, assignedAt }) => (
                <tr key={user.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{user.fullName}</td>
                  <td className="px-3 py-2"><Badge variant="outline" className="text-xs">{VI.roles[user.role as keyof typeof VI.roles] ?? user.role}</Badge></td>
                  <td className="px-3 py-2">{user.sipExtension ?? '—'}</td>
                  <td className="px-3 py-2">{format(new Date(assignedAt), 'dd/MM/yyyy')}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => removeMutation.mutate(user.id)} className="text-red-500 hover:text-red-700" disabled={removeMutation.isPending}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
