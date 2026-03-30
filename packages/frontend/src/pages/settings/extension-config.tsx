import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { X, Loader2, PhoneCall } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/services/api-client';

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
  if (status === 'Registered') return <Badge className="bg-green-100 text-green-800 border-green-200">Đã đăng ký</Badge>;
  if (status === 'Unregistered') return <Badge className="bg-red-100 text-red-800 border-red-200">Chưa đăng ký</Badge>;
  return <Badge variant="secondary">Không rõ</Badge>;
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
      <div className="flex items-center gap-2">
        <PhoneCall className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Cấu hình máy nhánh</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách máy nhánh</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="pb-3 text-left font-medium">Máy nhánh</th>
                  <th className="pb-3 text-left font-medium">Nhân viên</th>
                  <th className="pb-3 text-left font-medium">Email</th>
                  <th className="pb-3 text-left font-medium">Miền</th>
                  <th className="pb-3 text-left font-medium">Trạng thái</th>
                  <th className="pb-3 text-left font-medium">Gán agent</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {extensions.map((ext) => (
                  <tr key={ext.extension} className="hover:bg-muted/30">
                    <td className="py-3 font-mono font-semibold">{ext.extension}</td>
                    <td className="py-3">{ext.userFullName ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="py-3 text-muted-foreground">{ext.userEmail ?? '—'}</td>
                    <td className="py-3 text-muted-foreground">{ext.domain}</td>
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
                          <SelectValue placeholder="Chọn agent..." />
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
        </CardContent>
      </Card>
    </div>
  );
}
