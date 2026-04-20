import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Users2, Plus, Loader2, Pencil, Trash2, RefreshCw, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import api from '@/services/api-client';
import { SectionHeader } from '@/components/ops/section-header';

const TEAM_TYPES = [
  { value: 'telesale', label: 'Telesale' },
  { value: 'collection', label: 'Collection' },
];

interface Team {
  id: string;
  name: string;
  type: string;
  leaderId: string | null;
  leader: { id: string; fullName: string; email: string } | null;
  _count: { members: number };
  isActive: boolean;
  createdAt: string;
}

interface UserOption {
  id: string;
  fullName: string;
  email: string;
}

function typeLabel(type: string): string {
  return TEAM_TYPES.find((t) => t.value === type)?.label ?? type;
}

export default function TeamManagement() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editTeam, setEditTeam] = useState<Team | null>(null);
  const [deleteTeam, setDeleteTeam] = useState<Team | null>(null);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('');
  const [formLeaderId, setFormLeaderId] = useState('');
  const [formMemberIds, setFormMemberIds] = useState<string[]>([]);

  const { data: teamsResp, isLoading, isFetching, refetch } = useQuery<{ data: Team[] }>({
    queryKey: ['teams'],
    queryFn: () => api.get('/teams?limit=100').then((r) => r.data),
  });

  const { data: users = [] } = useQuery<UserOption[]>({
    queryKey: ['users-list'],
    queryFn: () =>
      api.get('/users', { params: { limit: 200 } }).then((r) =>
        (r.data.data ?? []).map((u: UserOption) => ({ id: u.id, fullName: u.fullName, email: u.email })),
      ),
  });

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; type: string; leaderId?: string; memberIds?: string[] }) =>
      api.post('/teams', payload).then((r) => r.data.data),
    onSuccess: () => {
      toast.success('Tạo team thành công');
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message || 'Tạo team thất bại'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...payload }: { id: string; name?: string; type?: string; leaderId?: string | null; memberIds?: string[] }) =>
      api.patch(`/teams/${id}`, payload).then((r) => r.data.data),
    onSuccess: () => {
      toast.success('Đã cập nhật team');
      setEditTeam(null);
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message || 'Cập nhật thất bại'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/teams/${id}`),
    onSuccess: () => {
      toast.success('Đã xóa team');
      setDeleteTeam(null);
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message || 'Xóa thất bại'),
  });

  function openCreate() {
    setFormName(''); setFormType(''); setFormLeaderId(''); setFormMemberIds([]);
    setCreateOpen(true);
  }

  function openEdit(team: Team) {
    setFormName(team.name);
    setFormType(team.type);
    setFormLeaderId(team.leaderId || '');
    setFormMemberIds([]); // Will be loaded from team members query
    setEditTeam(team);
    // Fetch current members
    api.get(`/teams/${team.id}/members`).then((r) => {
      const ids = (r.data.data ?? []).map((m: { id: string }) => m.id).filter((id: string) => id !== team.leaderId);
      setFormMemberIds(ids);
    }).catch(() => {});
  }

  function handleCreate() {
    if (!formName.trim()) { toast.error('Vui lòng nhập tên team'); return; }
    if (!formType) { toast.error('Vui lòng chọn loại team'); return; }
    createMutation.mutate({
      name: formName.trim(),
      type: formType,
      ...(formLeaderId && { leaderId: formLeaderId }),
      ...(formMemberIds.length > 0 && { memberIds: formMemberIds }),
    });
  }

  function handleUpdate() {
    if (!editTeam || !formName.trim()) return;
    updateMutation.mutate({
      id: editTeam.id,
      name: formName.trim(),
      type: formType || undefined,
      leaderId: formLeaderId || null,
      memberIds: formMemberIds,
    });
  }

  const allRows = teamsResp?.data ?? [];
  const rows = search
    ? allRows.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()) || typeLabel(t.type).toLowerCase().includes(search.toLowerCase()))
    : allRows;

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        label="Quản lý team"
        hint={`${allRows.length} nhóm`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
              Làm mới
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" />
              Tạo team
            </Button>
          </>
        }
      />

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Tìm team..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
      </div>

      <div className="rounded-sm border-dotted-2 bg-card overflow-hidden">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="py-3 px-4 text-left font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Tên team</th>
                <th className="py-3 px-4 text-left font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Loại</th>
                <th className="py-3 px-4 text-left font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Trưởng nhóm</th>
                <th className="py-3 px-4 text-center font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Thành viên</th>
                <th className="py-3 px-4 text-left font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Ngày tạo</th>
                <th className="py-3 px-4 w-[80px]" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-muted-foreground">
                    {search ? 'Không tìm thấy team phù hợp.' : 'Chưa có team nào.'}
                  </td>
                </tr>
              ) : rows.map((team) => (
                <tr key={team.id} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                  <td className="py-3 px-4 font-medium">{team.name}</td>
                  <td className="py-3 px-4"><Badge variant="outline" className="text-xs">{typeLabel(team.type)}</Badge></td>
                  <td className="py-3 px-4">{team.leader?.fullName ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="py-3 px-4 text-center">{team._count?.members ?? 0}</td>
                  <td className="py-3 px-4 text-muted-foreground text-xs">{new Date(team.createdAt).toLocaleDateString('vi-VN')}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1 justify-end">
                      <button title="Chỉnh sửa" onClick={() => openEdit(team)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-blue-600 transition-colors">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button title="Xóa" onClick={() => setDeleteTeam(team)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader><DialogTitle>Tạo team</DialogTitle></DialogHeader>
          <TeamForm
            name={formName} onNameChange={setFormName}
            type={formType} onTypeChange={setFormType}
            leaderId={formLeaderId} onLeaderChange={setFormLeaderId}
            memberIds={formMemberIds} onMemberIdsChange={setFormMemberIds}
            users={users}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Hủy</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Tạo team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTeam} onOpenChange={(v) => { if (!v) setEditTeam(null); }}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader><DialogTitle>Chỉnh sửa team</DialogTitle></DialogHeader>
          <TeamForm
            name={formName} onNameChange={setFormName}
            type={formType} onTypeChange={setFormType}
            leaderId={formLeaderId} onLeaderChange={setFormLeaderId}
            memberIds={formMemberIds} onMemberIdsChange={setFormMemberIds}
            users={users}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTeam(null)}>Hủy</Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTeam} onOpenChange={(v) => { if (!v) setDeleteTeam(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Xác nhận xóa team</DialogTitle></DialogHeader>
          {(deleteTeam?._count?.members ?? 0) > 0 ? (
            <p className="text-sm text-orange-600">
              Team <strong>{deleteTeam?.name}</strong> đang có {deleteTeam?._count?.members} thành viên. Vui lòng chuyển thành viên sang team khác trước khi xóa.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Bạn có chắc muốn xóa team <strong>{deleteTeam?.name}</strong>? Hành động này không thể hoàn tác.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTeam(null)}>Hủy</Button>
            <Button variant="destructive" onClick={() => deleteTeam && deleteMutation.mutate(deleteTeam.id)} disabled={deleteMutation.isPending || (deleteTeam?._count?.members ?? 0) > 0}>
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TeamForm({ name, onNameChange, type, onTypeChange, leaderId, onLeaderChange, memberIds, onMemberIdsChange, users }: {
  name: string; onNameChange: (v: string) => void;
  type: string; onTypeChange: (v: string) => void;
  leaderId: string; onLeaderChange: (v: string) => void;
  memberIds: string[]; onMemberIdsChange: (v: string[]) => void;
  users: UserOption[];
}) {
  const [memberSearch, setMemberSearch] = useState('');

  // Users available as members (exclude the leader)
  const availableMembers = useMemo(() => {
    return users.filter((u) => u.id !== leaderId && !memberIds.includes(u.id));
  }, [users, leaderId, memberIds]);

  const filteredMembers = memberSearch
    ? availableMembers.filter((u) => u.fullName.toLowerCase().includes(memberSearch.toLowerCase()) || u.email.toLowerCase().includes(memberSearch.toLowerCase()))
    : availableMembers;

  const selectedMembers = users.filter((u) => memberIds.includes(u.id));
  const leaderUser = users.find((u) => u.id === leaderId);

  function addMember(userId: string) {
    onMemberIdsChange([...memberIds, userId]);
    setMemberSearch('');
  }

  function removeMember(userId: string) {
    onMemberIdsChange(memberIds.filter((id) => id !== userId));
  }

  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="flex flex-col gap-1.5">
        <Label>Tên team <span className="text-destructive">*</span></Label>
        <Input placeholder="Nhập tên team..." value={name} onChange={(e) => onNameChange(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Loại <span className="text-destructive">*</span></Label>
        <select value={type} onChange={(e) => onTypeChange(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm bg-background">
          <option value="">— Chọn loại team —</option>
          {TEAM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Trưởng nhóm</Label>
        <select value={leaderId} onChange={(e) => onLeaderChange(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm bg-background">
          <option value="">— Chưa chọn —</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>)}
        </select>
        {leaderId && leaderUser && (
          <p className="text-xs text-muted-foreground">Đã chọn: {leaderUser.fullName}</p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Thành viên {selectedMembers.length > 0 && <span className="text-muted-foreground font-normal">({selectedMembers.length})</span>}</Label>
        {/* Selected members chips */}
        {selectedMembers.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedMembers.map((u) => (
              <span key={u.id} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-md border border-blue-200">
                {u.fullName}
                <button type="button" onClick={() => removeMember(u.id)} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        {/* Member search + dropdown */}
        <div className="relative">
          <Input
            placeholder="Tìm và thêm thành viên..."
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            className="h-9 text-sm"
          />
          {memberSearch && filteredMembers.length > 0 && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg max-h-40 overflow-y-auto">
              {filteredMembers.slice(0, 10).map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => addMember(u.id)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                >
                  {u.fullName} <span className="text-muted-foreground">({u.email})</span>
                </button>
              ))}
            </div>
          )}
          {memberSearch && filteredMembers.length === 0 && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg px-3 py-2 text-sm text-muted-foreground">
              Không tìm thấy
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
