import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/services/api-client';

function generatePassword() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#!';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

interface Props {
  open: boolean;
  clusterId: string;
  userId: string;
  onClose: () => void;
}

const fieldLabel = 'text-[12px] uppercase tracking-wider font-mono text-muted-foreground';
const inputHeight = 'h-[42px]';

export function AccountPasswordDialog({ open, clusterId, userId, onClose }: Props) {
  const [password, setPassword] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.post(`/clusters/${clusterId}/accounts/${userId}/change-password`, { newPassword: password }),
    onSuccess: () => {
      toast.success('Đã đổi mật khẩu. Người dùng sẽ phải đổi lại khi đăng nhập.');
      setPassword('');
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || 'Đổi mật khẩu thất bại');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) { toast.error('Mật khẩu phải ít nhất 6 ký tự'); return; }
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setPassword(''); onClose(); } }}>
      <DialogContent className="max-w-sm rounded-xl">
        <DialogHeader>
          <DialogTitle>Đổi mật khẩu</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className={fieldLabel}>Mật khẩu mới <span className="text-destructive">*</span></Label>
            <div className="flex gap-2">
              <Input
                className={`flex-1 ${inputHeight}`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tối thiểu 6 ký tự"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={inputHeight}
                title="Tạo ngẫu nhiên"
                onClick={() => setPassword(generatePassword())}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            {/* Password rules caption */}
            <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">
              Tối thiểu 6 ký tự · nên có chữ hoa + số + ký tự đặc biệt (@#!)<br />
              Người dùng sẽ được yêu cầu đổi mật khẩu khi đăng nhập lần tiếp theo.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setPassword(''); onClose(); }}>Hủy</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Xác nhận
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
