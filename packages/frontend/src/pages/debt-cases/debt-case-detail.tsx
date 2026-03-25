import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { VI } from '@/lib/vi-text';
import { formatMoney } from '@/lib/format';
import api from '@/services/api-client';
import type { DebtTier, DebtStatus } from '@shared/constants/enums';

interface DebtCase {
  id: string;
  totalAmount: number;
  paidAmount: number;
  tier: DebtTier;
  status: DebtStatus;
  dpd: number;
  createdAt: string;
  updatedAt: string;
  contact: { id: string; fullName: string; phone: string } | null;
  assignedTo: { fullName: string } | null;
}

export default function DebtCaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [ptpOpen, setPtpOpen] = useState(false);
  const [promiseDate, setPromiseDate] = useState('');
  const [promiseAmount, setPromiseAmount] = useState('');

  const { data: debt, isLoading } = useQuery({
    queryKey: ['debt-case', id],
    queryFn: () => api.get<{ data: DebtCase }>(`/debt-cases/${id}`).then((r) => r.data.data),
    enabled: !!id,
  });

  const ptpMutation = useMutation({
    mutationFn: () =>
      api.post(`/debt-cases/${id}/promise`, {
        promiseDate,
        promiseAmount: Number(promiseAmount),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debt-case', id] });
      toast.success('Đã ghi nhận cam kết trả');
      setPtpOpen(false);
      setPromiseDate('');
      setPromiseAmount('');
    },
    onError: () => toast.error('Lỗi khi ghi nhận PTP'),
  });

  function handleCall() {
    if (!debt?.contact?.phone) return;
    api.post('/calls/originate', { phone: debt.contact.phone }).then(() => {
      toast.success(`Đang gọi ${debt.contact!.phone}...`);
    }).catch(() => toast.error('Không thể thực hiện cuộc gọi'));
  }

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!debt) {
    return <p className="text-muted-foreground">{VI.actions.noData}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/debt-cases')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{debt.contact?.fullName || VI.debt.title}</h1>
          <div className="flex gap-2 mt-1">
            <Badge>{VI.debt.tiers[debt.tier]}</Badge>
            <Badge variant="outline">{VI.debt.statuses[debt.status]}</Badge>
          </div>
        </div>
        {debt.contact?.phone && (
          <Button variant="outline" onClick={handleCall}>
            <Phone className="mr-2 h-4 w-4" /> Gọi
          </Button>
        )}
        <Button onClick={() => setPtpOpen(true)}>{VI.debt.ptpTitle}</Button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Thông tin công nợ</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div><p className="text-xs text-muted-foreground">{VI.debt.amount}</p><p className="text-lg font-bold text-red-600">{formatMoney(debt.totalAmount)}</p></div>
            <div><p className="text-xs text-muted-foreground">{VI.debt.paidAmount}</p><p className="text-lg font-bold text-green-600">{formatMoney(debt.paidAmount)}</p></div>
            <div><p className="text-xs text-muted-foreground">Còn lại</p><p className="text-lg font-bold">{formatMoney(debt.totalAmount - debt.paidAmount)}</p></div>
            <div><p className="text-xs text-muted-foreground">{VI.debt.dpd}</p><p className="text-lg font-bold">{debt.dpd} ngày</p></div>
            <div><p className="text-xs text-muted-foreground">{VI.contact.assignedTo}</p><p className="font-medium">{debt.assignedTo?.fullName ?? '—'}</p></div>
            <div><p className="text-xs text-muted-foreground">{VI.contact.createdAt}</p><p className="font-medium">{format(new Date(debt.createdAt), 'dd/MM/yyyy HH:mm')}</p></div>
          </CardContent>
        </Card>

        {debt.contact && (
          <Card className="cursor-pointer hover:bg-accent/50" onClick={() => navigate(`/contacts/${debt.contact!.id}`)}>
            <CardHeader><CardTitle>Liên hệ</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-muted-foreground">{VI.contact.fullName}</p><p className="font-medium">{debt.contact.fullName}</p></div>
              <div><p className="text-xs text-muted-foreground">{VI.contact.phone}</p><p className="font-medium">{debt.contact.phone}</p></div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* PTP Dialog */}
      <Dialog open={ptpOpen} onOpenChange={setPtpOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{VI.debt.ptpTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>{VI.debt.promiseDate}</Label>
              <Input type="date" value={promiseDate} onChange={(e) => setPromiseDate(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>{VI.debt.promiseAmount}</Label>
              <Input type="number" min={0} value={promiseAmount} onChange={(e) => setPromiseAmount(e.target.value)} required />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPtpOpen(false)}>{VI.actions.cancel}</Button>
            <Button onClick={() => ptpMutation.mutate()} disabled={ptpMutation.isPending || !promiseDate || !promiseAmount}>
              {ptpMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {VI.actions.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
