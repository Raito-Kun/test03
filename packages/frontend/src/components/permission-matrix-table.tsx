import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

export interface PermissionRow {
  id: string;
  key: string;
  label: string;
  group: string;
  grants: Record<string, boolean>;
}

interface Props {
  rows: PermissionRow[];
  localGrants: Record<string, Record<string, boolean>>;
  onToggle: (row: PermissionRow, role: string, value: boolean) => void;
}

const EDITABLE_ROLES = ['admin', 'manager', 'qa', 'leader', 'agent_telesale', 'agent_collection'] as const;
export type EditableRole = (typeof EDITABLE_ROLES)[number];
export const ALL_ROLES = ['super_admin', ...EDITABLE_ROLES] as const;

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  manager: 'Quản lý',
  qa: 'QA',
  leader: 'Trưởng nhóm',
  agent_telesale: 'Telesale',
  agent_collection: 'Thu hồi nợ',
};

export const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  admin: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  manager: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  qa: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  leader: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  agent_telesale: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  agent_collection: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

function getGrant(row: PermissionRow, role: string, localGrants: Record<string, Record<string, boolean>>): boolean {
  if (role === 'super_admin') return true;
  if (localGrants[role]?.[row.key] !== undefined) return localGrants[role][row.key];
  return row.grants[role] ?? false;
}

export default function PermissionMatrixTable({ rows, localGrants, onToggle }: Props) {
  const groups = Array.from(new Set(rows.map((r) => r.group)));
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggleGroup(group: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

  function handleGroupToggle(groupRows: PermissionRow[], role: string, value: boolean) {
    if (role === 'super_admin') return;
    groupRows.forEach((row) => onToggle(row, role, value));
  }

  function groupAllGranted(groupRows: PermissionRow[], role: string): boolean {
    return groupRows.every((row) => getGrant(row, role, localGrants));
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-separate border-spacing-0">
        <thead>
          <tr className="bg-muted/50">
            <th className="sticky left-0 z-10 bg-muted/50 py-3 px-4 text-left font-semibold text-muted-foreground w-56 border-b">
              Quyền
            </th>
            {ALL_ROLES.map((role) => (
              <th key={role} className="py-3 px-3 text-center font-medium border-b min-w-[100px]">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[role]}`}>
                  {ROLE_LABELS[role]}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const groupRows = rows.filter((r) => r.group === group);
            const isCollapsed = collapsed.has(group);
            return (
              <>
                {/* Group header row */}
                <tr
                  key={`group-${group}`}
                  className="bg-muted/30 hover:bg-muted/50 cursor-pointer"
                  onClick={() => toggleGroup(group)}
                >
                  <td className="sticky left-0 z-10 bg-muted/30 py-2 px-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground border-b">
                    <div className="flex items-center gap-1.5">
                      {isCollapsed
                        ? <ChevronRight className="h-3.5 w-3.5" />
                        : <ChevronDown className="h-3.5 w-3.5" />}
                      {group}
                      <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0 h-4">
                        {groupRows.length}
                      </Badge>
                    </div>
                  </td>
                  {ALL_ROLES.map((role) => (
                    <td key={role} className="py-2 px-3 text-center border-b" onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={groupAllGranted(groupRows, role)}
                        onCheckedChange={role === 'super_admin' ? undefined : (val: boolean) => handleGroupToggle(groupRows, role, val)}
                        disabled={role === 'super_admin'}
                        size="sm"
                        className="mx-auto"
                      />
                    </td>
                  ))}
                </tr>

                {/* Permission rows */}
                {!isCollapsed && groupRows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                    <td className="sticky left-0 z-10 bg-background py-2 px-4 pl-8 text-sm border-b">
                      {row.label}
                    </td>
                    {ALL_ROLES.map((role) => (
                      <td key={role} className="py-2 px-3 text-center border-b">
                        <Switch
                          checked={getGrant(row, role, localGrants)}
                          onCheckedChange={role === 'super_admin' ? undefined : (val: boolean) => onToggle(row, role, val)}
                          disabled={role === 'super_admin'}
                          size="sm"
                          className="mx-auto"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
