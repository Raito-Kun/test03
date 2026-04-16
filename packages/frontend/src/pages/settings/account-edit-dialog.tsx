import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/services/api-client';

interface Props {
  open: boolean;
  clusterId: string;
  user: { id: string; fullName: string; email: string; role: string; extension?: string | null } | null;
  onClose: () => void;
  onSaved: () => void;
}

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'qa', label: 'QA' },
  { value: 'leader', label: 'Leader' },
  { value: 'agent', label: 'Agent' },
];

export function AccountEditDialog({ open, clusterId, user, onClose, onSaved }: Props) {
  const [form, setForm] = useState({ email: '', fullName: '', role: '', extension: '' });

  useEffect(() => {
    if (user) {
      setForm({ email: user.email, fullName: user.fullName, role: user.role, extension: user.extension || '' });
    }
  }, [user]);

  const mutation = useMutation({
    mutationFn: () => api.patch(`/users/${user?.id}`, {
      // Only send email when it actually changed — avoids needless uniqueness check.
      ...(user && form.email !== user.email && { email: form.email }),
      fullName: form.fullName || undefined,
      role: form.role || undefined,
      sipExtension: form.extension || null,
    }),
    onSuccess: () => {
      toast.success('Đã cập nhật tài khoản');
      onSaved();
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || 'Cập nhật thất bại');
    },
  });

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa tài khoản</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              placeholder="user@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Họ tên</Label>
            <Input value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <select
              value={form.role}
              onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            >
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Extension</Label>
            <Input value={form.extension} onChange={(e) => setForm((p) => ({ ...p, extension: e.target.value }))} placeholder="VD: 101" />
          </div>
        </div>
        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
