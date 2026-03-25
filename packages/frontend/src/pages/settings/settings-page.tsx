import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { VI } from '@/lib/vi-text';
import { useAuthStore } from '@/stores/auth-store';
import api from '@/services/api-client';

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');

  const passwordMutation = useMutation({
    mutationFn: () =>
      api.patch('/auth/me', { currentPassword, newPassword }),
    onSuccess: () => {
      toast.success('Đổi mật khẩu thành công');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwError('');
    },
    onError: () => toast.error('Đổi mật khẩu thất bại. Kiểm tra mật khẩu hiện tại.'),
  });

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPwError('');
    if (newPassword.length < 6) {
      setPwError('Mật khẩu mới tối thiểu 6 ký tự');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('Mật khẩu xác nhận không khớp');
      return;
    }
    passwordMutation.mutate();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{VI.settings.title}</h1>

      {/* Profile */}
      <Card>
        <CardHeader><CardTitle>{VI.settings.profileTitle}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div><p className="text-xs text-muted-foreground">{VI.contact.fullName}</p><p className="font-medium">{user?.fullName ?? '—'}</p></div>
          <div><p className="text-xs text-muted-foreground">{VI.email}</p><p className="font-medium">{user?.email ?? '—'}</p></div>
          <div><p className="text-xs text-muted-foreground">Vai trò</p><p className="font-medium">{user?.role ? VI.roles[user.role as keyof typeof VI.roles] || user.role : '—'}</p></div>
        </CardContent>
      </Card>

      <Separator />

      {/* Change password */}
      <Card>
        <CardHeader><CardTitle>{VI.settings.passwordTitle}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="max-w-md space-y-4">
            <div className="space-y-1">
              <Label htmlFor="currentPassword">{VI.settings.currentPassword}</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="newPassword">{VI.settings.newPassword}</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirmPassword">{VI.settings.confirmPassword}</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            {pwError && <p className="text-xs text-destructive">{pwError}</p>}
            <Button type="submit" disabled={passwordMutation.isPending}>
              {passwordMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {VI.settings.passwordTitle}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
