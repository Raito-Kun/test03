import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/services/api-client';
import { VI } from '@/lib/vi-text';

interface Props {
  open: boolean;
  clusterId: string;
  user: { id: string; fullName: string; email: string; role: string; extension?: string | null } | null;
  onClose: () => void;
  onSaved: () => void;
}

const ROLES = [
  { value: 'admin', label: VI.roles.admin },
  { value: 'manager', label: VI.roles.manager },
  { value: 'qa', label: VI.roles.qa },
  { value: 'leader', label: VI.roles.leader },
  { value: 'agent', label: VI.roles.agent },
];

const fieldLabel = 'text-[12px] uppercase tracking-wider font-mono text-muted-foreground';
const inputHeight = 'h-[42px]';

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
      <DialogContent className="max-w-md rounded-xl">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa tài khoản</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Basic info group */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className={fieldLabel}>Họ tên</Label>
              <Input
                className={inputHeight}
                value={form.fullName}
                onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className={fieldLabel}>Email</Label>
              <Input
                className={inputHeight}
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="user@example.com"
              />
            </div>
          </div>

          {/* Dashed divider */}
          <div className="dashed-divider" />

          {/* Role & extension group */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className={fieldLabel}>Vai trò</Label>
              <select
                value={form.role}
                onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                className={`w-full border rounded-md px-3 text-sm bg-background ${inputHeight}`}
              >
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className={fieldLabel}>Số máy lẻ</Label>
              <Input
                className={inputHeight}
                value={form.extension}
                onChange={(e) => setForm((p) => ({ ...p, extension: e.target.value }))}
                placeholder="VD: 101"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Lưu thay đổi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
