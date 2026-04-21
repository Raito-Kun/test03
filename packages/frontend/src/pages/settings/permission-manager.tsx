import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Loader2, ShieldCheck, Phone, BarChart2, Megaphone,
  FileText, Star, Settings, Radio,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuthStore } from '@/stores/auth-store';
import api from '@/services/api-client';
import PermissionMatrixTable from '@/components/permission-matrix-table';
import type { PermissionRow, EditableRole } from '@/components/permission-matrix-table';
import RoleTabPanel from '@/components/role-tab-panel';
import { ClusterSelect } from '@/components/cluster-select';
import { SectionHeader } from '@/components/ops/section-header';

interface ClusterOption { id: string; name: string; isActive: boolean }

const GROUP_LABEL_MAP: Record<string, string> = {
  campaign: 'Chiến dịch',
  crm: 'CRM',
  report: 'Báo cáo',
  switchboard: 'Tổng đài',
  ticket: 'Phiếu ghi',
  qa: 'QA',
  system: 'Hệ thống',
};

const GROUP_ICONS: Record<string, React.ElementType> = {
  campaign: Megaphone,
  crm: ShieldCheck,
  report: BarChart2,
  switchboard: Phone,
  ticket: FileText,
  qa: Star,
  system: Settings,
};

function GroupIcon({ group }: { group: string }) {
  const Icon = GROUP_ICONS[group] ?? Radio;
  return <Icon className="h-4 w-4 shrink-0" />;
}

export default function PermissionManager() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const isSuperAdmin = (user?.role as string) === 'super_admin';

  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [localGrants, setLocalGrants] = useState<Record<string, Record<string, boolean>>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [selectedClusterId, setSelectedClusterId] = useState<string>('');

  // Load clusters for super_admin to pick which tenant to edit.
  const { data: clusters } = useQuery<ClusterOption[]>({
    queryKey: ['clusters-for-perm-matrix'],
    queryFn: async () => {
      const { data } = await api.get('/clusters');
      return (data.data ?? []) as ClusterOption[];
    },
    enabled: isSuperAdmin,
  });

  // Default cluster: super_admin → first cluster; others → their own.
  useEffect(() => {
    if (selectedClusterId) return;
    if (isSuperAdmin && clusters && clusters.length > 0) {
      setSelectedClusterId(clusters.find((c) => c.isActive)?.id ?? clusters[0].id);
    }
  }, [isSuperAdmin, clusters, selectedClusterId]);

  // Effective cluster for API calls: super_admin passes their pick,
  // non-super always targets their own (server ignores query for them).
  const effectiveClusterId = isSuperAdmin ? selectedClusterId : '';

  const { data: permissions, isLoading } = useQuery<PermissionRow[]>({
    queryKey: ['permissions', effectiveClusterId],
    queryFn: async () => {
      const url = effectiveClusterId
        ? `/permissions?clusterId=${encodeURIComponent(effectiveClusterId)}`
        : '/permissions';
      const { data } = await api.get(url);
      return (data.data ?? []) as PermissionRow[];
    },
    enabled: hasPermission('system.permissions') && (!isSuperAdmin || !!effectiveClusterId),
  });

  // Set the first group as active once data loads
  useEffect(() => {
    if (permissions && permissions.length > 0 && activeGroup === null) {
      setActiveGroup(permissions[0].group);
    }
  }, [permissions, activeGroup]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const qs = effectiveClusterId ? `?clusterId=${encodeURIComponent(effectiveClusterId)}` : '';
      const ops = Object.entries(localGrants).map(([role, grants]) =>
        api.put(`/permissions/role/${role}${qs}`, { grants })
      );
      await Promise.all(ops);
    },
    onSuccess: () => {
      toast.success('Đã lưu thay đổi quyền thành công');
      setLocalGrants({});
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
    },
    onError: () => toast.error('Lưu thất bại, vui lòng thử lại'),
  });

  const handleToggle = useCallback((row: PermissionRow, role: string, value: boolean) => {
    setLocalGrants((prev) => ({
      ...prev,
      [role]: { ...(prev[role] ?? {}), [row.key]: value },
    }));
    setIsDirty(true);
  }, []);

  if (!hasPermission('system.permissions')) {
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

  const rows: PermissionRow[] = permissions ?? [];
  const allGroups = Array.from(new Set(rows.map((r) => r.group)));
  const currentGroup = activeGroup ?? allGroups[0] ?? null;
  const filteredRows = currentGroup ? rows.filter((r) => r.group === currentGroup) : rows;

  return (
    <div className="flex flex-col gap-0 relative">
      <div className="flex items-center gap-2 mb-4">
        <SectionHeader
          label="Quản lý phân quyền"
          actions={isSuperAdmin && clusters && clusters.length > 0 ? (
            <ClusterSelect
              clusters={clusters}
              value={selectedClusterId}
              onChange={setSelectedClusterId}
            />
          ) : undefined}
          className="flex-1"
        />
      </div>

      <Tabs defaultValue="matrix" className="flex flex-col gap-4">
        <TabsList className="w-fit">
          <TabsTrigger value="matrix">Ma trận quyền</TabsTrigger>
          <TabsTrigger value="roles">Vai trò</TabsTrigger>
        </TabsList>

        {/* Permission Matrix Tab */}
        <TabsContent value="matrix" className="m-0">
          <div className="flex gap-4">
            {/* Left sidebar */}
            <div className="w-[220px] shrink-0">
              <ScrollArea className="h-[calc(100vh-220px)] rounded-sm border-dotted-2 bg-card">
                <div className="p-2 space-y-0.5">
                  <p className="px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    Nhóm quyền
                  </p>
                  {allGroups.map((group) => {
                    const isActive = group === currentGroup;
                    const groupCount = rows.filter((r) => r.group === group).length;
                    return (
                      <button
                        key={group}
                        onClick={() => setActiveGroup(group)}
                        className={`w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-left transition-colors ${
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-muted text-foreground'
                        }`}
                      >
                        <span className={isActive ? 'text-primary-foreground' : 'text-muted-foreground'}>
                          <GroupIcon group={group} />
                        </span>
                        <span className="flex-1 truncate">{GROUP_LABEL_MAP[group] ?? group}</span>
                        <span className={`text-xs rounded-full px-1.5 ${
                          isActive
                            ? 'bg-primary-foreground/20 text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {groupCount}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* Right panel */}
            <div className="flex-1 min-w-0 rounded-sm border-dotted-2 bg-card overflow-hidden">
              <div className="p-3 border-b flex items-center gap-2">
                {currentGroup && <GroupIcon group={currentGroup} />}
                <span className="font-medium text-sm">{currentGroup ? (GROUP_LABEL_MAP[currentGroup] ?? currentGroup) : 'Tất cả quyền'}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {filteredRows.length} quyền
                </span>
              </div>
              <PermissionMatrixTable
                rows={filteredRows}
                localGrants={localGrants}
                onToggle={handleToggle}
              />
            </div>
          </div>
        </TabsContent>

        {/* Roles Tab */}
        <TabsContent value="roles" className="m-0">
          <RoleTabPanel permissions={rows} />
        </TabsContent>
      </Tabs>

      {/* Fixed save button — only shown when there are unsaved changes */}
      {isDirty && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="shadow-lg"
          >
            {saveMutation.isPending
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Đang lưu...</>
              : 'Lưu thay đổi'}
          </Button>
        </div>
      )}
    </div>
  );
}
