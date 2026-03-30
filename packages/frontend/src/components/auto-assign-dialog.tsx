import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Users } from 'lucide-react';
import api from '@/services/api-client';

interface AutoAssignDialogProps {
  campaignId: string;
  campaignName: string;
  onComplete?: () => void;
}

const MODES = [
  { value: 'round_robin', label: 'Chia đều (Round-robin)' },
  { value: 'workload', label: 'Theo khối lượng công việc' },
  { value: 'skill', label: 'Theo kỹ năng sản phẩm' },
] as const;

export function AutoAssignButton({ campaignId, campaignName, onComplete }: AutoAssignDialogProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<string>('round_robin');
  const [teamId, setTeamId] = useState<string>('');

  const { data: teams } = useQuery({
    queryKey: ['teams-for-assign'],
    queryFn: async () => {
      const { data: resp } = await api.get('/teams');
      return resp.data as { id: string; name: string }[];
    },
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: resp } = await api.post('/assignments/auto-assign', { campaignId, teamId, mode });
      return resp.data as { total: number; perAgent: Record<string, number>; mode: string };
    },
    onSuccess: (result) => {
      if (result.total === 0) {
        toast.info('Không có lead chưa phân bổ');
      } else {
        const summary = Object.entries(result.perAgent).map(([name, count]) => `${name}: ${count}`).join(', ');
        toast.success(`Đã phân bổ ${result.total} lead: ${summary}`);
      }
      setOpen(false);
      onComplete?.();
    },
    onError: (err: Error) => {
      toast.error(`Lỗi phân bổ: ${err.message}`);
    },
  });

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Users className="h-4 w-4 mr-1" />
        Phân bổ tự động
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Phân bổ lead tự động</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Chiến dịch: <strong>{campaignName}</strong>
            </p>

            <div className="space-y-1">
              <label className="text-sm font-medium">Nhóm nhân viên</label>
              <Select value={teamId || undefined} onValueChange={(v) => setTeamId(v || '')}>
                <SelectTrigger className="w-full">
                  {teamId
                    ? <span>{teams?.find((t) => t.id === teamId)?.name || teamId}</span>
                    : <span className="text-muted-foreground">Chọn nhóm</span>}
                </SelectTrigger>
                <SelectContent>
                  {teams?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Phương thức phân bổ</label>
              <Select value={mode} onValueChange={(v) => setMode(v || 'round_robin')}>
                <SelectTrigger className="w-full">
                  <span>{MODES.find((m) => m.value === mode)?.label || mode}</span>
                </SelectTrigger>
                <SelectContent>
                  {MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Hủy</Button>
            <Button onClick={() => mutation.mutate()} disabled={!teamId || mutation.isPending}>
              {mutation.isPending ? 'Đang phân bổ...' : 'Phân bổ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
