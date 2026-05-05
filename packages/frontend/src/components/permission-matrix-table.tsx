import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { isSuperAdminOptIn } from '@/lib/permission-constants';

const GROUP_LABEL_MAP: Record<string, string> = {
  campaign: 'Chiến dịch',
  crm: 'CRM',
  report: 'Báo cáo',
  switchboard: 'Tổng đài',
  ticket: 'Phiếu ghi',
  qa: 'QA',
  system: 'Hệ thống',
};

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

const EDITABLE_ROLES = ['admin', 'manager', 'supervisor', 'qa', 'leader', 'agent'] as const;
export type EditableRole = (typeof EDITABLE_ROLES)[number];
export const ALL_ROLES = ['super_admin', ...EDITABLE_ROLES] as const;

// Re-export from single source of truth (@/lib/vi-text) so every screen stays in sync.
// Kept as a named const to preserve the prior import path and avoid a sweeping rename.
import { VI } from '@/lib/vi-text';
export const ROLE_LABELS: Record<string, string> = { ...VI.roles };

export const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  admin: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  manager: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  supervisor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  qa: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  leader: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  agent: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
};

function isSuperAdminLocked(rowKey: string): boolean {
  return !isSuperAdminOptIn(rowKey);
}

function getGrant(row: PermissionRow, role: string, localGrants: Record<string, Record<string, boolean>>): boolean {
  if (role === 'super_admin' && isSuperAdminLocked(row.key)) return true;
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
    const editable = role === 'super_admin'
      ? groupRows.filter((row) => !isSuperAdminLocked(row.key))
      : groupRows;
    if (editable.length === 0) return;
    editable.forEach((row) => onToggle(row, role, value));
  }

  function groupAllGranted(groupRows: PermissionRow[], role: string): boolean {
    return groupRows.every((row) => getGrant(row, role, localGrants));
  }

  function groupHeaderDisabled(groupRows: PermissionRow[], role: string): boolean {
    if (role !== 'super_admin') return false;
    // Header switch is only meaningful for super_admin if at least one row in the
    // group is opt-in (editable). Otherwise the column is fully locked ON.
    return groupRows.every((row) => isSuperAdminLocked(row.key));
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
                      {GROUP_LABEL_MAP[group] ?? group}
                      <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0 h-4">
                        {groupRows.length}
                      </Badge>
                    </div>
                  </td>
                  {ALL_ROLES.map((role) => {
                    const disabled = groupHeaderDisabled(groupRows, role);
                    return (
                      <td key={role} className="py-2 px-3 text-center border-b" onClick={(e) => e.stopPropagation()}>
                        <Switch
                          checked={groupAllGranted(groupRows, role)}
                          onCheckedChange={disabled ? undefined : (val: boolean) => handleGroupToggle(groupRows, role, val)}
                          disabled={disabled}
                          size="sm"
                          className="mx-auto"
                        />
                      </td>
                    );
                  })}
                </tr>

                {/* Permission rows */}
                {!isCollapsed && groupRows.map((row) => {
                  // Highlight rows where super_admin is opt-in editable — visually
                  // emphasises the row that requires explicit approval.
                  const isOptInRow = isSuperAdminOptIn(row.key);
                  return (
                    <tr
                      key={row.id}
                      className={`border-b last:border-0 transition-colors ${
                        isOptInRow ? 'bg-accent/30 hover:bg-accent/50' : 'hover:bg-muted/10'
                      }`}
                    >
                      <td className={`sticky left-0 z-10 py-2 px-4 pl-8 text-sm border-b ${
                        isOptInRow ? 'bg-accent/30 font-medium text-accent-foreground' : 'bg-background'
                      }`}>
                        {row.label}
                      </td>
                      {ALL_ROLES.map((role) => {
                        const disabled = role === 'super_admin' && isSuperAdminLocked(row.key);
                        // Super_admin opt-in row: ring around the editable switch
                        // makes the unique action obvious in a sea of locked switches.
                        const ringEditable = role === 'super_admin' && isOptInRow;
                        return (
                          <td key={role} className="py-2 px-3 text-center border-b">
                            <span className={ringEditable
                              ? 'inline-flex items-center justify-center rounded-full p-1 ring-2 ring-primary/60 ring-offset-1 ring-offset-background'
                              : 'inline-flex'
                            }>
                              <Switch
                                checked={getGrant(row, role, localGrants)}
                                onCheckedChange={disabled ? undefined : (val: boolean) => onToggle(row, role, val)}
                                disabled={disabled}
                                size="sm"
                                className="mx-auto"
                              />
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
