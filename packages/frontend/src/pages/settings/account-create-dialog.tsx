import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/services/api-client';
import { VI } from '@/lib/vi-text';

interface Extension {
  id: string;
  extension: string;
  callerName: string;
}

interface Props {
  open: boolean;
  clusterId: string;
  extensions: Extension[];
  onClose: () => void;
  onCreated: () => void;
}

const ROLES = [
  { value: 'admin', label: VI.roles.admin },
  { value: 'manager', label: VI.roles.manager },
  { value: 'qa', label: VI.roles.qa },
  { value: 'leader', label: VI.roles.leader },
  { value: 'agent', label: VI.roles.agent },
];

function generatePassword() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#!';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const EMPTY = { fullName: '', email: '', role: 'agent', extension: '', password: '' };

const fieldLabel = 'text-[12px] uppercase tracking-wider font-mono text-muted-foreground';
const inputHeight = 'h-[42px]';

export function AccountCreateDialog({ open, clusterId, extensions, onClose, onCreated }: Props) {
  const [form, setForm] = useState({ ...EMPTY });

  function update<K extends keyof typeof EMPTY>(k: K, v: string) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  const mutation = useMutation({
    mutationFn: () => api.post(`/clusters/${clusterId}/accounts`, {
      fullName: form.fullName,
      email: form.email,
      role: form.role,
      extension: form.extension || null,
      password: form.password,
    }),
    onSuccess: () => {
      toast.success(`Đã tạo tài khoản ${form.email}`);
      setForm({ ...EMPTY });
      onCreated();
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || 'Tạo thất bại');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fullName || !form.email || !form.password) {
      toast.error('Vui lòng điền đầy đủ thông tin');
      return;
    }
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md rounded-xl">
        <DialogHeader>
          <DialogTitle>Tạo tài khoản mới</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic info group */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className={fieldLabel}>Họ tên <span className="text-destructive">*</span></Label>
              <Input className={inputHeight} value={form.fullName} onChange={(e) => update('fullName', e.target.value)} placeholder="Nguyễn Văn A" />
            </div>
            <div className="space-y-1.5">
              <Label className={fieldLabel}>Email <span className="text-destructive">*</span></Label>
              <Input className={inputHeight} type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="user@cluster.local" />
            </div>
          </div>

          {/* Dashed divider */}
          <div className="dashed-divider" />

          {/* Role & extension group */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className={fieldLabel}>Vai trò <span className="text-destructive">*</span></Label>
              <select
                value={form.role}
                onChange={(e) => update('role', e.target.value)}
                className={`w-full border rounded-md px-3 text-sm bg-background ${inputHeight}`}
              >
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className={fieldLabel}>Số máy lẻ</Label>
              <select
                value={form.extension}
                onChange={(e) => update('extension', e.target.value)}
                className={`w-full border rounded-md px-3 text-sm bg-background ${inputHeight}`}
              >
                <option value="">(Chưa gán)</option>
                {extensions.map((ext) => (
                  <option key={ext.id} value={ext.extension}>
                    {ext.extension}{ext.callerName ? ` — ${ext.callerName}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dashed divider */}
          <div className="dashed-divider" />

          {/* Password group */}
          <div className="space-y-1.5">
            <Label className={fieldLabel}>Mật khẩu <span className="text-destructive">*</span></Label>
            <div className="flex gap-2">
              <Input
                className={`flex-1 ${inputHeight}`}
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                placeholder="Tối thiểu 6 ký tự"
              />
              <Button type="button" variant="outline" size="icon" className={inputHeight} title="Tạo mật khẩu ngẫu nhiên" onClick={() => update('password', generatePassword())}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <p className="font-mono text-[11px] text-muted-foreground">Tối thiểu 6 ký tự, nên có chữ hoa + số + ký tự đặc biệt.</p>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Tạo tài khoản
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
