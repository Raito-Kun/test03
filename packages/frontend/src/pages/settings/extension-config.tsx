import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { X, Loader2, ChevronRight, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/services/api-client';
import { DottedCard } from '@/components/ops/dotted-card';

interface ExtensionInfo {
  extension: string;
  userId: string | null;
  userFullName: string | null;
  userEmail: string | null;
  domain: string;
  status: 'Registered' | 'Unregistered' | 'Unknown';
}

interface UserOption {
  id: string;
  fullName: string;
  email: string;
}

function StatusBadge({ status }: { status: ExtensionInfo['status'] }) {
  if (status === 'Registered') return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Đã đăng ký
    </span>
  );
  if (status === 'Unregistered') return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
      Chưa đăng ký
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted border border-border px-2 py-0.5 rounded-full">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
      Không rõ
    </span>
  );
}

export default function ExtensionConfig() {
  const queryClient = useQueryClient();

  const { data: extensions = [], isLoading } = useQuery<ExtensionInfo[]>({
    queryKey: ['extensions'],
    queryFn: () => api.get('/extensions').then((r) => r.data.data),
    refetchInterval: 30_000,
  });

  const { data: users = [] } = useQuery<UserOption[]>({
    queryKey: ['users-list'],
    queryFn: () =>
      api.get('/users', { params: { limit: 100 } }).then((r) =>
        (r.data.data ?? []).map((u: { id: string; fullName: string; email: string }) => ({
          id: u.id,
          fullName: u.fullName,
          email: u.email,
        })),
      ),
  });

  const assignMutation = useMutation({
    mutationFn: ({ ext, userId }: { ext: string; userId: string | null }) =>
      api.put(`/extensions/${ext}/assign`, { userId }),
    onSuccess: () => {
      toast.success('Đã cập nhật máy nhánh');
      queryClient.invalidateQueries({ queryKey: ['extensions'] });
    },
    onError: () => toast.error('Cập nhật thất bại'),
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm">
        <Settings className="h-3.5 w-3.5 text-muted-foreground" />
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">Cài đặt</span>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-primary font-semibold">Cấu hình máy nhánh</span>
      </nav>

      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cấu hình máy nhánh</h1>
        <p className="text-sm text-muted-foreground mt-1">Gán và quản lý extension SIP cho từng nhân viên</p>
      </div>

      <div className="border-b border-dashed border-border" />

      <DottedCard header="Danh sách máy nhánh">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="pb-3 text-left font-mono text-[11px] uppercase tracking-wider">Máy nhánh</th>
                <th className="pb-3 text-left font-mono text-[11px] uppercase tracking-wider">Nhân viên</th>
                <th className="pb-3 text-left font-mono text-[11px] uppercase tracking-wider">Email</th>
                <th className="pb-3 text-left font-mono text-[11px] uppercase tracking-wider">Miền</th>
                <th className="pb-3 text-left font-mono text-[11px] uppercase tracking-wider">Trạng thái</th>
                <th className="pb-3 text-left font-mono text-[11px] uppercase tracking-wider">Gán agent</th>
                <th className="pb-3" />
              </tr>
            </thead>
              <tbody className="divide-y">
                {extensions.map((ext) => (
                  <tr key={ext.extension} className="hover:bg-muted/30">
                    <td className="py-3 font-mono font-semibold text-primary">{ext.extension}</td>
                    <td className="py-3">{ext.userFullName ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="py-3 text-muted-foreground font-mono text-xs">{ext.userEmail ?? '—'}</td>
                    <td className="py-3 text-muted-foreground font-mono text-xs">{ext.domain}</td>
                    <td className="py-3"><StatusBadge status={ext.status} /></td>
                    <td className="py-3 min-w-[200px]">
                      <Select
                        value={ext.userId ?? '__none__'}
                        onValueChange={(val) =>
                          assignMutation.mutate({ ext: ext.extension, userId: val === '__none__' ? null : val })
                        }
                        disabled={assignMutation.isPending}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue>
                            {ext.userId ? (ext.userFullName || ext.userEmail || 'Đã gán') : 'Chọn agent...'}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Không gán —</SelectItem>
                          {users.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.fullName} ({u.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-3">
                      {ext.userId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => assignMutation.mutate({ ext: ext.extension, userId: null })}
                          disabled={assignMutation.isPending}
                          title="Bỏ gán"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DottedCard>
    </div>
  );
}
