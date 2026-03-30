import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/auth-store';
import api from '@/services/api-client';

interface PermissionRow {
  id: string;
  key: string;
  label: string;
  group: string;
  grants: Record<string, boolean>;
}

const EDITABLE_ROLES = ['admin', 'manager', 'qa', 'leader', 'agent_telesale', 'agent_collection'] as const;
type EditableRole = (typeof EDITABLE_ROLES)[number];

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  manager: 'Manager',
  qa: 'QA',
  leader: 'Leader',
  agent_telesale: 'Telesale',
  agent_collection: 'Collection',
};

const ALL_COLUMNS = ['super_admin', ...EDITABLE_ROLES];

export default function PermissionManager() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const queryClient = useQueryClient();

  // localGrants tracks unsaved changes: { [role]: { [key]: boolean } }
  const [localGrants, setLocalGrants] = useState<Record<string, Record<string, boolean>>>({});
  const [dirtyRoles, setDirtyRoles] = useState<Set<string>>(new Set());

  const { data: permissions, isLoading } = useQuery<PermissionRow[]>({
    queryKey: ['permissions'],
    queryFn: async () => {
      const { data } = await api.get('/permissions');
      return data.data;
    },
    enabled: hasPermission('manage_permissions'),
  });

  const saveMutation = useMutation({
    mutationFn: async (role: EditableRole) => {
      const grants = localGrants[role] ?? {};
      await api.put(`/permissions/role/${role}`, { grants });
    },
    onSuccess: (_data, role) => {
      toast.success(`Đã lưu quyền cho ${ROLE_LABELS[role]}`);
      setDirtyRoles((prev) => { const next = new Set(prev); next.delete(role); return next; });
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
    },
    onError: () => toast.error('Lưu thất bại'),
  });

  if (!hasPermission('manage_permissions')) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Bạn không có quyền truy cập trang này.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const rows = permissions ?? [];

  // Group rows by group field
  const groups = Array.from(new Set(rows.map((r) => r.group)));

  function getGrant(row: PermissionRow, role: string): boolean {
    if (role === 'super_admin') return true;
    // Local override takes priority
    if (localGrants[role]?.[row.key] !== undefined) return localGrants[role][row.key];
    return row.grants[role] ?? false;
  }

  function toggleGrant(row: PermissionRow, role: EditableRole, value: boolean) {
    setLocalGrants((prev) => ({
      ...prev,
      [role]: { ...(prev[role] ?? {}), [row.key]: value },
    }));
    setDirtyRoles((prev) => new Set(prev).add(role));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-blue-500" />
        <h1 className="text-xl font-semibold">Quản lý phân quyền</h1>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ma trận quyền theo vai trò</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-4 text-left font-medium text-muted-foreground w-48">Quyền</th>
                {ALL_COLUMNS.map((role) => (
                  <th key={role} className="py-2 px-3 text-center font-medium">
                    <div className="flex flex-col items-center gap-1">
                      <span>{ROLE_LABELS[role]}</span>
                      {role === 'super_admin' && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">Toàn quyền</Badge>
                      )}
                      {dirtyRoles.has(role) && role !== 'super_admin' && (
                        <Button
                          size="sm"
                          className="h-6 text-[11px] px-2"
                          onClick={() => saveMutation.mutate(role as EditableRole)}
                          disabled={saveMutation.isPending}
                        >
                          {saveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Lưu'}
                        </Button>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <>
                  <tr key={`group-${group}`} className="bg-muted/30">
                    <td colSpan={ALL_COLUMNS.length + 1} className="py-1.5 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {group}
                    </td>
                  </tr>
                  {rows.filter((r) => r.group === group).map((row) => (
                    <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="py-2 pr-4 text-sm">{row.label}</td>
                      {ALL_COLUMNS.map((role) => (
                        <td key={role} className="py-2 px-3 text-center">
                          <Switch
                            checked={getGrant(row, role)}
                            onCheckedChange={
                              role === 'super_admin'
                                ? undefined
                                : (val: boolean) => toggleGrant(row, role as EditableRole, val)
                            }
                            disabled={role === 'super_admin'}
                            className="mx-auto"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
