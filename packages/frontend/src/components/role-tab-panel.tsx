import { useQuery } from '@tanstack/react-query';
import { Users, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/services/api-client';
import { ROLE_LABELS, ROLE_COLORS } from '@/components/permission-matrix-table';
import type { PermissionRow } from '@/components/permission-matrix-table';

interface User {
  id: string;
  role: string;
  fullName: string;
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  super_admin: 'Toàn quyền hệ thống, không giới hạn truy cập.',
  admin: 'Quản lý người dùng, cấu hình hệ thống và chiến dịch.',
  manager: 'Quản lý nhóm, theo dõi hiệu suất và phân công công việc.',
  qa: 'Đánh giá chất lượng cuộc gọi và phiếu ghi.',
  leader: 'Dẫn dắt nhóm agent, xem báo cáo nhóm.',
  agent_telesale: 'Thực hiện cuộc gọi telesale, quản lý lead.',
  agent_collection: 'Thực hiện cuộc gọi thu hồi nợ, quản lý hồ sơ nợ.',
};

const ROLE_VI_NAMES: Record<string, string> = {
  super_admin: 'Quản trị viên cao cấp',
  admin: 'Quản trị viên',
  manager: 'Quản lý',
  qa: 'QA',
  leader: 'Trưởng nhóm',
  agent_telesale: 'Nhân viên Telesale',
  agent_collection: 'Nhân viên Thu hồi nợ',
};

const ALL_ROLES = ['super_admin', 'admin', 'manager', 'qa', 'leader', 'agent_telesale', 'agent_collection'];

interface Props {
  permissions: PermissionRow[];
}

export default function RoleTabPanel({ permissions }: Props) {
  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ['users-list'],
    queryFn: async () => {
      const { data } = await api.get('/users');
      return data.data ?? [];
    },
  });

  function getMemberCount(role: string): number {
    return (users ?? []).filter((u) => u.role === role).length;
  }

  function getTopPermissions(role: string): string[] {
    if (role === 'super_admin') {
      return permissions.slice(0, 5).map((p) => p.label);
    }
    return permissions
      .filter((p) => p.grants[role] === true)
      .slice(0, 5)
      .map((p) => p.label);
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {ALL_ROLES.map((role) => {
        const count = getMemberCount(role);
        const topPerms = getTopPermissions(role);
        const totalPerms = role === 'super_admin'
          ? permissions.length
          : permissions.filter((p) => p.grants[role] === true).length;

        return (
          <Card key={role} className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{ROLE_VI_NAMES[role]}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">{ROLE_LABELS[role]}</p>
                </div>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[role]}`}>
                  {ROLE_LABELS[role]}
                </span>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 flex-1">
              <p className="text-sm text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>

              {/* Member count */}
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                {isLoading ? (
                  <Skeleton className="h-4 w-16" />
                ) : (
                  <span>
                    <span className="font-semibold">{count}</span> thành viên
                  </span>
                )}
              </div>

              {/* Permissions summary */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>{totalPerms} quyền</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {topPerms.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">Chưa có quyền nào</span>
                  ) : (
                    <>
                      {topPerms.map((perm) => (
                        <Badge key={perm} variant="outline" className="text-[10px] px-1.5 py-0">
                          {perm}
                        </Badge>
                      ))}
                      {totalPerms > 5 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          +{totalPerms - 5} khác
                        </Badge>
                      )}
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
