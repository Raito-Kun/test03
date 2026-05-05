import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus, Upload, KeyRound, Trash2, Ban, CheckCircle2,
  Pencil, Search, X, MoreHorizontal, Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { VI } from '@/lib/vi-text';
import { format } from 'date-fns';
import api from '@/services/api-client';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AccountCreateDialog } from './account-create-dialog';
import { AccountPasswordDialog } from './account-password-dialog';
import { AccountImportDialog } from './account-import-dialog';
import { AccountEditDialog } from './account-edit-dialog';

type StatusFilter = 'all' | 'active' | 'inactive';

interface ClusterUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  extension?: string | null;
  clusterId?: string | null;
  teamName?: string | null;
  createdAt: string;
}

interface ClusterExtension {
  id: string;
  extension: string;
  callerName: string;
}

// Derive two-letter initials
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_COLORS = [
  'bg-indigo-100 text-indigo-700',
  'bg-pink-100 text-pink-700',
  'bg-amber-100 text-amber-700',
  'bg-emerald-100 text-emerald-700',
  'bg-violet-100 text-violet-700',
  'bg-cyan-100 text-cyan-700',
];
function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const ROLE_PILL: Record<string, string> = {
  super_admin: 'bg-violet-100 text-violet-700',
  admin: 'bg-teal-100 text-teal-700',
  manager: 'bg-amber-100 text-amber-700',
  leader: 'bg-blue-100 text-blue-700',
  agent: 'bg-slate-100 text-slate-700',
  qa: 'bg-pink-100 text-pink-700',
  super_agent: 'bg-emerald-100 text-emerald-700',
};

const ROLE_SEGMENTS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'super_admin', label: VI.roles.super_admin },
  { value: 'admin', label: VI.roles.admin },
  { value: 'manager', label: VI.roles.manager },
  { value: 'leader', label: VI.roles.leader },
  { value: 'agent', label: VI.roles.agent },
];

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
      if (q && !((u.fullName ?? '').toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q) || (u.role ?? '').toLowerCase().includes(q))) return false;
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      return true;
    });
  }, [users, search, roleFilter, statusFilter]);

  const hasActiveFilter = !!search || roleFilter !== 'all' || statusFilter !== 'all';
  const resetFilters = () => { setSearch(''); setRoleFilter('all'); setStatusFilter('all'); };

  const segmentChip = (value: string, active: boolean) =>
    cn(
      'px-3 py-1.5 text-xs font-medium rounded-full transition-colors cursor-pointer',
      active
        ? 'bg-primary text-primary-foreground'
        : 'bg-muted/60 hover:bg-muted text-muted-foreground',
    );

  const TABLE_HEADERS = [
    { label: 'HỌ TÊN' },
    { label: 'VAI TRÒ' },
    { label: 'SĐT MÁY NHÁNH' },
    { label: 'TEAM' },
    { label: 'TRẠNG THÁI' },
    { label: 'NGÀY TẠO' },
    { label: '' },
  ];

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Action bar */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground font-mono">
          {clusterName} — {hasActiveFilter ? `${filteredUsers.length} / ${users.length}` : users.length} tài khoản
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleExportExtensions}>
            <Download className="h-4 w-4 mr-1.5" />
            Export ext
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-1.5" />
            Nhập danh sách
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Tạo tài khoản
          </Button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Tìm kiếm tên, email, vai trò..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-xl bg-muted/40 border-border"
        />
      </div>

      {/* Role segment chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {ROLE_SEGMENTS.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setRoleFilter(s.value)}
            className={segmentChip(s.value, roleFilter === s.value)}
          >
            {s.label}
          </button>
        ))}
        {/* Status toggle */}
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => setStatusFilter('all')} className={cn('px-3 py-1.5 text-xs font-medium border-y border-r first:border-l first:rounded-l-md last:rounded-r-md transition-colors', statusFilter === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted text-muted-foreground border-input')}>
            Tất cả
          </button>
          <button type="button" onClick={() => setStatusFilter('active')} className={cn('px-3 py-1.5 text-xs font-medium border-y border-r transition-colors', statusFilter === 'active' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted text-muted-foreground border-input')}>
            Hoạt động
          </button>
          <button type="button" onClick={() => setStatusFilter('inactive')} className={cn('px-3 py-1.5 text-xs font-medium border-y border-r rounded-r-md transition-colors', statusFilter === 'inactive' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted text-muted-foreground border-input')}>
            Vô hiệu
          </button>
          {hasActiveFilter && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 px-2 text-xs ml-1">
              <X className="h-3.5 w-3.5 mr-1" /> Xóa lọc
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex h-48 items-center justify-center text-muted-foreground text-sm">Đang tải...</div>
      ) : users.length === 0 ? (
        <div className="flex h-48 items-center justify-center border rounded-xl border-dashed text-muted-foreground text-sm">
          Chưa có tài khoản nào trong cụm này
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="flex h-48 items-center justify-center border rounded-xl border-dashed text-muted-foreground text-sm">
          Không có tài khoản phù hợp với bộ lọc
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto border-dotted-2 rounded-sm">
          <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 220 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 60 }} />
            </colgroup>
            <thead className="bg-muted/50 sticky top-0 z-10">
              <tr className="border-b">
                {TABLE_HEADERS.map((h, i) => (
                  <th key={i} className="text-left px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const rolePill = ROLE_PILL[user.role] ?? 'bg-slate-100 text-slate-700';
                const isActive = user.status === 'active';
                return (
                  <tr key={user.id} className="hover:bg-muted/20 border-b last:border-b-0">
                    {/* HỌ TÊN */}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor(user.fullName)}`}>
                          {getInitials(user.fullName)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{user.fullName}</p>
                          <p className="font-mono text-[11px] text-muted-foreground truncate">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    {/* VAI TRÒ */}
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${rolePill}`}>
                        {VI.roles[user.role as keyof typeof VI.roles] ?? user.role}
                      </span>
                    </td>
                    {/* SĐT MÁY NHÁNH */}
                    <td className="px-4 py-2.5">
                      {user.extension ? (
                        <span className="font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-sm">{user.extension}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">(chưa gán)</span>
                      )}
                    </td>
                    {/* TEAM */}
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-muted-foreground">{user.teamName ?? '—'}</span>
                    </td>
                    {/* TRẠNG THÁI */}
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${isActive ? 'text-emerald-700' : 'text-slate-500'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    {/* NGÀY TẠO */}
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs text-muted-foreground">
                        {format(new Date(user.createdAt), 'dd/MM/yyyy')}
                      </span>
                    </td>
                    {/* ACTIONS */}
                    <td className="px-4 py-2.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditUser(user)}>
                            <Pencil className="mr-2 h-4 w-4" /> Chỉnh sửa
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setPwdUserId(user.id)}>
                            <KeyRound className="mr-2 h-4 w-4" /> Đổi mật khẩu
                          </DropdownMenuItem>
                          {user.status === 'active' ? (
                            <DropdownMenuItem onClick={() => statusMutation.mutate({ userId: user.id, status: 'inactive' })}>
                              <Ban className="mr-2 h-4 w-4" /> Vô hiệu hóa
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => statusMutation.mutate({ userId: user.id, status: 'active' })}>
                              <CheckCircle2 className="mr-2 h-4 w-4" /> Kích hoạt
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => { if (confirm(`Xóa tài khoản "${user.fullName}"?`)) deleteMutation.mutate(user.id); }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Xóa tài khoản
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
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
