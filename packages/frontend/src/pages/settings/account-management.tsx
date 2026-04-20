import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Users, Plus, Download, Upload, KeyRound, Trash2, Ban, CheckCircle2, Pencil, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import api from '@/services/api-client';
import { SectionHeader } from '@/components/ops/section-header';
import { AccountCreateDialog } from './account-create-dialog';
import { AccountPasswordDialog } from './account-password-dialog';
import { AccountImportDialog } from './account-import-dialog';
import { AccountEditDialog } from './account-edit-dialog';

type StatusFilter = 'all' | 'active' | 'inactive';
type ExtFilter = 'all' | 'with' | 'without';

const ROLE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'Tất cả vai trò' },
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'qa', label: 'QA' },
  { value: 'leader', label: 'Leader' },
  { value: 'agent', label: 'Agent' },
];

const EXT_LABELS: Record<ExtFilter, string> = {
  all: 'Tất cả extension',
  with: 'Có extension',
  without: 'Chưa gán',
};

interface ClusterUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  extension?: string | null;
  clusterId?: string | null;
  createdAt: string;
}

interface ClusterExtension {
  id: string;
  extension: string;
  callerName: string;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  manager: 'Manager',
  supervisor: 'Supervisor',
  qa: 'QA',
  leader: 'Leader',
  agent: 'Agent',
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  active: { label: 'Hoạt động', className: 'bg-[var(--color-status-ok)]/10 text-[var(--color-status-ok)] border-[var(--color-status-ok)]/30' },
  inactive: { label: 'Vô hiệu', className: 'bg-[var(--color-status-err)]/10 text-[var(--color-status-err)] border-[var(--color-status-err)]/30' },
};

function groupByRole(users: ClusterUser[]): Record<string, ClusterUser[]> {
  const groups: Record<string, ClusterUser[]> = {};
  for (const u of users) {
    if (!groups[u.role]) groups[u.role] = [];
    groups[u.role].push(u);
  }
  return groups;
}

function RoleGroup({
  role, users, onEdit, onChangePassword, onToggleStatus, onDelete,
}: {
  role: string;
  users: ClusterUser[];
  onEdit: (user: ClusterUser) => void;
  onChangePassword: (userId: string) => void;
  onToggleStatus: (userId: string, status: string) => void;
  onDelete: (userId: string, name: string) => void;
}) {
  return (
    <>
      <tr className="bg-muted/70">
        <td colSpan={6} className="px-4 py-2 border-t border-b">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{ROLE_LABELS[role] || role}</span>
            <span className="text-xs text-muted-foreground">{users.length} tài khoản</span>
          </div>
        </td>
      </tr>
      {users.map((user) => {
        const sb = STATUS_BADGE[user.status] ?? STATUS_BADGE.active;
        return (
          <tr key={user.id} className="hover:bg-muted/20 border-b last:border-b-0">
            <td className="px-4 py-2.5 pl-6 font-medium truncate">{user.fullName}</td>
            <td className="px-4 py-2.5 text-muted-foreground truncate">{user.email}</td>
            <td className="px-4 py-2.5">
              {user.extension ? (
                <span className="font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-sm">{user.extension}</span>
              ) : (
                <span className="text-xs text-muted-foreground">(chưa gán)</span>
              )}
            </td>
            <td className="px-4 py-2.5">
              <Badge className={`text-[10px] ${sb.className}`}>{sb.label}</Badge>
            </td>
            <td className="px-4 py-2.5 text-xs text-muted-foreground">
              {new Date(user.createdAt).toLocaleDateString('vi-VN')}
            </td>
            <td className="px-4 py-2.5">
              <div className="flex items-center gap-1 justify-end">
                <button title="Chỉnh sửa" onClick={() => onEdit(user)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-blue-600 transition-colors">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button title="Đổi mật khẩu" onClick={() => onChangePassword(user.id)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                  <KeyRound className="h-3.5 w-3.5" />
                </button>
                {user.status === 'active' ? (
                  <button title="Vô hiệu hóa" onClick={() => onToggleStatus(user.id, 'inactive')} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-orange-600 transition-colors">
                    <Ban className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button title="Kích hoạt" onClick={() => onToggleStatus(user.id, 'active')} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-green-600 transition-colors">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </button>
                )}
                <button title="Xóa tài khoản" onClick={() => onDelete(user.id, user.fullName)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </td>
          </tr>
        );
      })}
    </>
  );
}

interface Props {
  clusterId: string;
  clusterName: string;
}

export default function AccountManagement({ clusterId, clusterName }: Props) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [pwdUserId, setPwdUserId] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<ClusterUser | null>(null);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [extFilter, setExtFilter] = useState<ExtFilter>('all');

  const { data: users = [], isLoading } = useQuery<ClusterUser[]>({
    queryKey: ['cluster-accounts', clusterId],
    queryFn: () => api.get(`/clusters/${clusterId}/accounts`).then((r) => r.data.data ?? []),
    enabled: !!clusterId,
  });

  const { data: extensions = [] } = useQuery<ClusterExtension[]>({
    queryKey: ['cluster-extensions', clusterId],
    queryFn: () => api.get(`/clusters/${clusterId}/extensions`).then((r) => r.data.data ?? []),
    enabled: !!clusterId,
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/clusters/${clusterId}/accounts/${userId}`),
    onSuccess: () => {
      toast.success('Đã xóa tài khoản');
      queryClient.invalidateQueries({ queryKey: ['cluster-accounts', clusterId] });
    },
    onError: () => toast.error('Xóa thất bại'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: string }) =>
      api.patch(`/clusters/${clusterId}/accounts/${userId}/status`, { status }),
    onSuccess: (_, { status }) => {
      toast.success(status === 'active' ? 'Đã kích hoạt tài khoản' : 'Đã vô hiệu hóa tài khoản');
      queryClient.invalidateQueries({ queryKey: ['cluster-accounts', clusterId] });
    },
    onError: () => toast.error('Cập nhật thất bại'),
  });

  function handleExportExtensions() {
    if (!extensions.length) { toast.error('Chưa có extensions nào để export'); return; }
    const csv = ['Extension,Tên caller\n', ...extensions.map((e) => `${e.extension},${e.callerName || ''}\n`)].join('');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extensions_${clusterName}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (q && !((u.fullName ?? '').toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q))) return false;
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (extFilter === 'with' && !u.extension) return false;
      if (extFilter === 'without' && u.extension) return false;
      return true;
    });
  }, [users, search, roleFilter, statusFilter, extFilter]);

  const hasActiveFilter = !!search || roleFilter !== 'all' || statusFilter !== 'all' || extFilter !== 'all';
  const resetFilters = () => { setSearch(''); setRoleFilter('all'); setStatusFilter('all'); setExtFilter('all'); };

  const groups = groupByRole(filteredUsers);
  const roleOrder = ['super_admin', 'admin', 'manager', 'supervisor', 'qa', 'leader', 'agent'];
  const sortedRoles = Object.keys(groups).sort((a, b) => roleOrder.indexOf(a) - roleOrder.indexOf(b));

  const pillClass = (active: boolean) =>
    cn(
      'px-3 py-1.5 text-xs font-medium border-y border-r first:border-l first:rounded-l-md last:rounded-r-md transition-colors',
      active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted text-muted-foreground border-input',
    );

  return (
    <div className="flex flex-col h-full space-y-4">
      <SectionHeader
        label="Quản lý tài khoản"
        hint={`${clusterName} — ${hasActiveFilter ? `${filteredUsers.length} / ${users.length}` : users.length} tài khoản`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleExportExtensions}>
              <Download className="h-4 w-4 mr-1.5" />
              Export ext
            </Button>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4 mr-1.5" />
              Import CSV
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Tạo tài khoản
            </Button>
          </>
        }
      />

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên hoặc email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v ?? 'all')}>
          <SelectTrigger size="sm" className="w-44">
            <SelectValue>{(v) => ROLE_FILTER_OPTIONS.find((o) => o.value === v)?.label ?? 'Tất cả vai trò'}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ROLE_FILTER_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={extFilter} onValueChange={(v) => setExtFilter((v ?? 'all') as ExtFilter)}>
          <SelectTrigger size="sm" className="w-44">
            <SelectValue>{(v) => EXT_LABELS[v as ExtFilter] ?? EXT_LABELS.all}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả extension</SelectItem>
            <SelectItem value="with">Có extension</SelectItem>
            <SelectItem value="without">Chưa gán</SelectItem>
          </SelectContent>
        </Select>
        <div className="inline-flex" role="group" aria-label="Lọc trạng thái">
          <button type="button" onClick={() => setStatusFilter('all')} className={pillClass(statusFilter === 'all')}>Tất cả</button>
          <button type="button" onClick={() => setStatusFilter('active')} className={pillClass(statusFilter === 'active')}>Hoạt động</button>
          <button type="button" onClick={() => setStatusFilter('inactive')} className={pillClass(statusFilter === 'inactive')}>Vô hiệu</button>
        </div>
        {hasActiveFilter && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 px-2 text-xs">
            <X className="h-3.5 w-3.5 mr-1" /> Xóa lọc
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center text-muted-foreground text-sm">
          Đang tải...
        </div>
      ) : users.length === 0 ? (
        <div className="flex h-48 items-center justify-center border rounded-lg text-muted-foreground text-sm">
          Chưa có tài khoản nào trong cụm này
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="flex h-48 items-center justify-center border rounded-lg text-muted-foreground text-sm">
          Không có tài khoản phù hợp với bộ lọc
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto border-dotted-2 rounded-sm">
          <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 200 }} />
              <col style={{ width: 280 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 100 }} />
            </colgroup>
            <thead className="bg-muted/50 sticky top-0 z-10">
              <tr className="border-b">
                <th className="text-left px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Họ tên</th>
                <th className="text-left px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Email</th>
                <th className="text-left px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Extension</th>
                <th className="text-left px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Trạng thái</th>
                <th className="text-left px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Ngày tạo</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {sortedRoles.map((role) => (
                <RoleGroup
                  key={role}
                  role={role}
                  users={groups[role]}
                  onEdit={setEditUser}
                  onChangePassword={setPwdUserId}
                  onToggleStatus={(userId, status) => statusMutation.mutate({ userId, status })}
                  onDelete={(userId, name) => { if (confirm(`Xóa tài khoản "${name}"?`)) deleteMutation.mutate(userId); }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AccountCreateDialog
        open={createOpen}
        clusterId={clusterId}
        extensions={extensions}
        onClose={() => setCreateOpen(false)}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ['cluster-accounts', clusterId] })}
      />

      <AccountPasswordDialog
        open={!!pwdUserId}
        clusterId={clusterId}
        userId={pwdUserId ?? ''}
        onClose={() => setPwdUserId(null)}
      />

      <AccountImportDialog
        open={importOpen}
        clusterId={clusterId}
        onClose={() => setImportOpen(false)}
        onImported={() => queryClient.invalidateQueries({ queryKey: ['cluster-accounts', clusterId] })}
      />

      <AccountEditDialog
        open={!!editUser}
        clusterId={clusterId}
        user={editUser}
        onClose={() => setEditUser(null)}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['cluster-accounts', clusterId] })}
      />
    </div>
  );
}
