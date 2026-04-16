import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import api from '@/services/api-client';
import { useAuthStore } from '@/stores/auth-store';
import type { ContactImportRow, DuplicateEntry, Agent } from './contact-import-wizard-types';

export type AssignmentPlan = Map<number, string | null>;

interface Props {
  uniques: ContactImportRow[];
  duplicates: DuplicateEntry[];
  onAssignmentChange: (plan: AssignmentPlan) => void;
}

const ALLOWED_ROLES = ['super_admin', 'admin', 'manager', 'leader'];
type Mode = 'random' | 'manual';

function getActionableRows(uniques: ContactImportRow[], duplicates: DuplicateEntry[]) {
  return [
    ...uniques.map((r) => ({ row: r, action: 'create' as const })),
    ...duplicates
      .filter((d) => d.action !== 'skip' && d.action !== 'keep')
      .map((d) => ({ row: d.new, action: d.action })),
  ];
}

function RandomMode({ agents, totalRows, onConfirm }: {
  agents: Agent[]; totalRows: number; onConfirm: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const perAgent = selected.size > 0 ? Math.ceil(totalRows / selected.size) : 0;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Chọn nhân viên để chia đều bản ghi (round-robin):</p>
      <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded p-2">
        {agents.map((a) => (
          <label key={a.id} className="flex items-center gap-2 cursor-pointer text-sm">
            <Checkbox checked={selected.has(a.id)} onCheckedChange={() => toggle(a.id)} />
            <span>{a.fullName}</span>
            <Badge variant="outline" className="text-xs">{a.role}</Badge>
          </label>
        ))}
      </div>
      {selected.size > 0 && (
        <p className="text-xs text-muted-foreground">Mỗi nhân viên sẽ nhận ~{perAgent} bản ghi</p>
      )}
      <Button size="sm" disabled={selected.size === 0} onClick={() => onConfirm(Array.from(selected))}>
        Xác nhận phân công
      </Button>
    </div>
  );
}

function ManualMode({ rows, agents, plan, onChange }: {
  rows: { row: ContactImportRow; action: string }[];
  agents: Agent[];
  plan: AssignmentPlan;
  onChange: (rowNumber: number, userId: string | null) => void;
}) {
  return (
    <div className="overflow-auto max-h-64 border rounded">
      <table className="w-full text-sm">
        <thead className="bg-muted sticky top-0">
          <tr>
            <th className="px-2 py-1 text-left w-10">STT</th>
            <th className="px-2 py-1 text-left">Họ tên</th>
            <th className="px-2 py-1 text-left">SĐT</th>
            <th className="px-2 py-1 text-left w-24">Action</th>
            <th className="px-2 py-1 text-left w-44">Chọn nhân viên</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ row, action }) => (
            <tr key={row.rowNumber} className="border-t">
              <td className="px-2 py-1 text-muted-foreground">{row.rowNumber}</td>
              <td className="px-2 py-1">{row.fullName}</td>
              <td className="px-2 py-1">{row.phone}</td>
              <td className="px-2 py-1">
                <Badge variant="secondary" className="text-xs">{action}</Badge>
              </td>
              <td className="px-2 py-1">
                <Select
                  value={plan.get(row.rowNumber) ?? '__none__'}
                  onValueChange={(v) => onChange(row.rowNumber, v === '__none__' ? null : v)}
                >
                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.fullName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ContactImportStepAssign({ uniques, duplicates, onAssignmentChange }: Props) {
  const role = useAuthStore.getState().user?.role ?? '';
  const allowed = ALLOWED_ROLES.includes(role);
  const [mode, setMode] = useState<Mode>('random');
  const [plan, setPlan] = useState<AssignmentPlan>(new Map());

  const { data: agents = [], isLoading, refetch } = useQuery({
    queryKey: ['assignable-agents', 'online'],
    queryFn: () =>
      api.get<{ success: boolean; data: Agent[] }>('/data-allocation/agents?onlineOnly=true')
        .then((r) => r.data.data),
    enabled: allowed,
  });

  const actionableRows = getActionableRows(uniques, duplicates);
  const total = actionableRows.length;

  const switchMode = useCallback((next: Mode) => {
    setMode(next);
    const empty: AssignmentPlan = new Map();
    setPlan(empty);
    onAssignmentChange(empty);
  }, [onAssignmentChange]);

  const handleRandomConfirm = useCallback((selectedAgents: string[]) => {
    const next: AssignmentPlan = new Map();
    actionableRows.forEach(({ row }, idx) => {
      next.set(row.rowNumber, selectedAgents[idx % selectedAgents.length]);
    });
    setPlan(next);
    onAssignmentChange(next);
  }, [actionableRows, onAssignmentChange]);

  const handleManualChange = useCallback((rowNumber: number, userId: string | null) => {
    setPlan((prev) => {
      const next = new Map(prev);
      next.set(rowNumber, userId);
      onAssignmentChange(next);
      return next;
    });
  }, [onAssignmentChange]);

  if (!allowed) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        Chỉ quản trị viên / leader / trưởng nhóm mới có thể phân công nhân viên. Liên hệ quản lý để hoàn tất import.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">
        Tổng: <span className="text-primary">{total}</span> bản ghi sẽ được tạo/cập nhật
      </p>
      <div className="flex gap-2">
        {(['random', 'manual'] as Mode[]).map((m) => (
          <button key={m} type="button" onClick={() => switchMode(m)}
            className={`px-3 py-1.5 text-sm rounded border transition-colors ${
              mode === m
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:bg-muted'
            }`}
          >
            {m === 'random' ? 'Random (chia đều)' : 'Manual (chọn thủ công)'}
          </button>
        ))}
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Đang tải danh sách nhân viên…</p>}
      {!isLoading && agents.length === 0 && (
        <div className="flex items-center gap-3 rounded border p-3 text-sm text-muted-foreground">
          <span>Không có nhân viên đang online / sẵn sàng</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Thử lại</Button>
        </div>
      )}
      {!isLoading && agents.length > 0 && mode === 'random' && (
        <RandomMode agents={agents} totalRows={total} onConfirm={handleRandomConfirm} />
      )}
      {!isLoading && agents.length > 0 && mode === 'manual' && (
        <ManualMode rows={actionableRows} agents={agents} plan={plan} onChange={handleManualChange} />
      )}
      {plan.size > 0 && (
        <p className="text-xs text-muted-foreground">
          Đã phân công {[...plan.values()].filter(Boolean).length} / {total} bản ghi
        </p>
      )}
    </div>
  );
}
