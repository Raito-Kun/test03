import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import api from '@/services/api-client';

type EntityType = 'contact' | 'lead' | 'debt_case';
type Mode = 'random' | 'manual';

interface Agent {
  id: string;
  fullName: string;
  role: string;
}

interface DataAllocationDialogProps {
  open: boolean;
  onClose: () => void;
  entityType: EntityType;
  selectedIds: string[];
  onSuccess?: () => void;
}

const ENTITY_LABELS: Record<EntityType, string> = {
  contact: 'liên hệ',
  lead: 'lead',
  debt_case: 'hồ sơ nợ',
};

/** Split selectedIds evenly across selectedAgentIds — round-robin. */
function roundRobin(ids: string[], agentIds: string[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  agentIds.forEach((a) => out.set(a, []));
  ids.forEach((id, i) => out.get(agentIds[i % agentIds.length])!.push(id));
  return out;
}

export function DataAllocationDialog({
  open, onClose, entityType, selectedIds, onSuccess,
}: DataAllocationDialogProps) {
  const [mode, setMode] = useState<Mode>('random');
  // Random mode — set of agent IDs to distribute to.
  const [randomAgents, setRandomAgents] = useState<Set<string>>(new Set());
  // Manual mode — per-entity assignment.
  const [manualMap, setManualMap] = useState<Map<string, string>>(new Map());

  const { data: agentsData, isLoading: loadingAgents } = useQuery({
    queryKey: ['data-allocation-agents'],
    queryFn: () => api.get<{ success: boolean; data: Agent[] }>('/data-allocation/agents').then((r) => r.data.data),
    enabled: open,
  });
  const agents = useMemo(() => agentsData ?? [], [agentsData]);

  // Allocator — groups assignments by target userId, one /allocate POST per group.
  const allocateMutation = useMutation({
    mutationFn: async (groups: Map<string, string[]>) => {
      let total = 0;
      for (const [userId, ids] of groups.entries()) {
        if (ids.length === 0) continue;
        await api.post('/data-allocation/allocate', {
          entityType,
          entityIds: ids,
          assignToUserId: userId,
        });
        total += ids.length;
      }
      return total;
    },
    onSuccess: (total) => {
      toast.success(`Đã phân bổ ${total} ${ENTITY_LABELS[entityType]} thành công`);
      resetAndClose();
      onSuccess?.();
    },
    onError: (err: { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(err?.response?.data?.error?.message || 'Phân bổ thất bại');
    },
  });

  const resetAndClose = useCallback(() => {
    setRandomAgents(new Set());
    setManualMap(new Map());
    setMode('random');
    onClose();
  }, [onClose]);

  const toggleRandomAgent = (id: string) => {
    setRandomAgents((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const setManualAssignment = (entityId: string, userId: string) => {
    setManualMap((prev) => {
      const next = new Map(prev);
      if (!userId) next.delete(entityId);
      else next.set(entityId, userId);
      return next;
    });
  };

  function handleConfirm() {
    if (mode === 'random') {
      const chosen = Array.from(randomAgents);
      if (chosen.length === 0) { toast.error('Chọn ít nhất 1 nhân viên'); return; }
      allocateMutation.mutate(roundRobin(selectedIds, chosen));
      return;
    }
    // Manual mode — reverse the per-entity map into per-agent groups.
    if (manualMap.size === 0) { toast.error('Chưa gán ai cho bản ghi nào'); return; }
    const groups = new Map<string, string[]>();
    for (const [entityId, userId] of manualMap.entries()) {
      if (!groups.has(userId)) groups.set(userId, []);
      groups.get(userId)!.push(entityId);
    }
    allocateMutation.mutate(groups);
  }

  const perAgent = randomAgents.size > 0 ? Math.ceil(selectedIds.length / randomAgents.size) : 0;
  const manualAssignedCount = manualMap.size;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetAndClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Phân bổ dữ liệu</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Đang phân bổ <span className="font-medium text-foreground">{selectedIds.length}</span>{' '}
            {ENTITY_LABELS[entityType]}.
          </p>

          <div className="flex gap-2">
            {(['random', 'manual'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
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

          {loadingAgents && <p className="text-sm text-muted-foreground">Đang tải danh sách nhân viên…</p>}
          {!loadingAgents && agents.length === 0 && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              Không có nhân viên khả dụng.
            </p>
          )}

          {!loadingAgents && agents.length > 0 && mode === 'random' && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Chọn nhân viên để chia đều bản ghi (round-robin):</p>
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto border rounded p-2">
                {agents.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox
                      checked={randomAgents.has(a.id)}
                      onCheckedChange={() => toggleRandomAgent(a.id)}
                    />
                    <span>{a.fullName}</span>
                    <Badge variant="outline" className="text-xs">{a.role}</Badge>
                  </label>
                ))}
              </div>
              {randomAgents.size > 0 && (
                <p className="text-xs text-muted-foreground">
                  Mỗi nhân viên sẽ nhận ~<b>{perAgent}</b> bản ghi
                </p>
              )}
            </div>
          )}

          {!loadingAgents && agents.length > 0 && mode === 'manual' && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Gán từng bản ghi cho nhân viên cụ thể. Bản ghi không gán sẽ bị bỏ qua.
              </p>
              <div className="overflow-auto max-h-72 border rounded">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="px-2 py-1 text-left w-16">STT</th>
                      <th className="px-2 py-1 text-left">ID bản ghi</th>
                      <th className="px-2 py-1 text-left w-52">Nhân viên</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedIds.map((id, idx) => (
                      <tr key={id} className="border-t">
                        <td className="px-2 py-1 text-muted-foreground">{idx + 1}</td>
                        <td className="px-2 py-1 font-mono text-xs truncate" title={id}>{id.slice(0, 8)}…</td>
                        <td className="px-2 py-1">
                          <Select
                            value={manualMap.get(id) ?? '__none__'}
                            onValueChange={(v) => setManualAssignment(id, !v || v === '__none__' ? '' : v)}
                          >
                            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">—</SelectItem>
                              {agents.map((a) => (
                                <SelectItem key={a.id} value={a.id}>{a.fullName}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                Đã gán <b className="text-foreground">{manualAssignedCount}</b> / {selectedIds.length}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose} disabled={allocateMutation.isPending}>
            Hủy
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={
              allocateMutation.isPending ||
              agents.length === 0 ||
              (mode === 'random' && randomAgents.size === 0) ||
              (mode === 'manual' && manualMap.size === 0)
            }
          >
            {allocateMutation.isPending ? 'Đang phân bổ...' : 'Xác nhận phân bổ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
