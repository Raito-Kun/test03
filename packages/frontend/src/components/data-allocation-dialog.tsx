import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import api from '@/services/api-client';

type EntityType = 'contact' | 'lead' | 'debt_case';

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

export function DataAllocationDialog({
  open, onClose, entityType, selectedIds, onSuccess,
}: DataAllocationDialogProps) {
  const [selectedAgentId, setSelectedAgentId] = useState('');

  const { data: agentsData, isLoading: loadingAgents } = useQuery({
    queryKey: ['data-allocation-agents'],
    queryFn: () => api.get<{ success: boolean; data: Agent[] }>('/data-allocation/agents').then((r) => r.data.data),
    enabled: open,
  });

  const allocateMutation = useMutation({
    mutationFn: () =>
      api.post('/data-allocation/allocate', {
        entityType,
        entityIds: selectedIds,
        assignToUserId: selectedAgentId,
      }),
    onSuccess: (res) => {
      const count = res.data?.data?.updatedCount ?? selectedIds.length;
      toast.success(`Đã phân bổ ${count} ${ENTITY_LABELS[entityType]} thành công`);
      setSelectedAgentId('');
      onSuccess?.();
      onClose();
    },
    onError: (err: { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(err?.response?.data?.error?.message || 'Phân bổ thất bại');
    },
  });

  function handleClose() {
    setSelectedAgentId('');
    onClose();
  }

  function handleConfirm() {
    if (!selectedAgentId) {
      toast.error('Vui lòng chọn nhân viên');
      return;
    }
    allocateMutation.mutate();
  }

  const agents = agentsData ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Phân bổ dữ liệu</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Đang phân bổ <span className="font-medium text-foreground">{selectedIds.length}</span>{' '}
            {ENTITY_LABELS[entityType]} cho nhân viên.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="agent-select">Chọn nhân viên</Label>
            <Select
              value={selectedAgentId}
              onValueChange={(v) => setSelectedAgentId(v ?? '')}
              disabled={loadingAgents}
            >
              <SelectTrigger id="agent-select">
                <SelectValue placeholder={loadingAgents ? 'Đang tải...' : 'Chọn nhân viên'} />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.fullName}
                  </SelectItem>
                ))}
                {agents.length === 0 && !loadingAgents && (
                  <SelectItem value="_empty" disabled>
                    Không có nhân viên khả dụng
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={allocateMutation.isPending}>
            Hủy
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedAgentId || allocateMutation.isPending}
          >
            {allocateMutation.isPending ? 'Đang phân bổ...' : 'Xác nhận phân bổ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
