import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCustomerTabStore } from '@/stores/customer-tab-store';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { FileText, Phone, Edit2, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ClickToCallButton } from '@/components/click-to-call-button';
import { Badge } from '@/components/ui/badge';
import { DottedCard } from '@/components/ops/dotted-card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { VI } from '@/lib/vi-text';
import { formatMoney, fmtPhone } from '@/lib/format';
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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function dpdPillClass(dpd: number): string {
  if (dpd > 30) return 'bg-[var(--color-status-err)]/10 text-[var(--color-status-err)] border border-[var(--color-status-err)]/20';
  if (dpd > 0) return 'bg-[var(--color-status-warn)]/10 text-[var(--color-status-warn)] border border-[var(--color-status-warn)]/20';
  return 'bg-muted text-muted-foreground border border-border';
}

type ActiveTab = 'info' | 'history' | 'links' | 'notes';

export default function DebtCaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [ptpOpen, setPtpOpen] = useState(false);
  const [promiseDate, setPromiseDate] = useState('');
  const [promiseAmount, setPromiseAmount] = useState('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('info');

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

  const updateTabLabel = useCustomerTabStore((s) => s.updateTabLabel);
  useEffect(() => {
    if (id && debt?.contact?.fullName) updateTabLabel(id, debt.contact.fullName);
  }, [id, debt?.contact?.fullName, updateTabLabel]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!debt) {
    return <p className="text-muted-foreground">{VI.actions.noData}</p>;
  }

  const customerName = debt.contact?.fullName ?? VI.debt.title;
  const remaining = debt.totalAmount - debt.paidAmount;

  return (
    <div className="space-y-4">
      {/* ── Header card ── */}
      <div className="bg-card rounded-xl shadow-sm p-6 border border-dashed border-border">
        <div className="flex items-start justify-between gap-4">
          {/* Left: avatar + name + DPD pill */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-accent/30 border border-dashed border-border flex items-center justify-center font-bold text-xl text-primary font-mono">
              {initials(customerName)}
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-semibold text-foreground">{customerName}</h2>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${dpdPillClass(debt.dpd)}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  DPD {debt.dpd}
                </span>
              </div>
              {debt.contact && (
                <p className="text-xs text-muted-foreground mt-1 font-mono">
                  {fmtPhone(debt.contact.phone)} •&nbsp;
                  ID: {debt.contact.id.slice(0, 12).toUpperCase()}
                </p>
              )}
            </div>
          </div>

          {/* Right: action stack */}
          <div className="flex items-center gap-2 shrink-0">
            {debt.contact?.phone && (
              <ClickToCallButton phone={debt.contact.phone} contactName={customerName} />
            )}
            <Button
              variant="outline"
              className="h-9 border-dashed font-bold text-sm gap-2"
              onClick={() => navigate('/tickets')}
            >
              <FileText className="h-4 w-4" />
              Tạo phiếu
            </Button>
            <Button onClick={() => setPtpOpen(true)} className="h-9 bg-primary hover:bg-primary/90 font-bold text-sm gap-2">
              <Calendar className="h-4 w-4" />
              {VI.debt.ptpTitle}
            </Button>
          </div>
        </div>
      </div>

      {/* ── KPI tile row ── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="bg-card rounded-xl border border-dashed border-border p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground font-mono mb-1">
            {VI.debt.amount}
          </p>
          <p className="text-lg font-bold font-mono text-[var(--color-status-err)]">
            {formatMoney(debt.totalAmount)}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-dashed border-border p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground font-mono mb-1">
            Đã thanh toán
          </p>
          <p className="text-lg font-bold font-mono text-[var(--color-status-ok)]">
            {formatMoney(debt.paidAmount)}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-dashed border-border p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground font-mono mb-1">
            {VI.debt.dpd}
          </p>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono ${dpdPillClass(debt.dpd)}`}>
            {debt.dpd} ngày
          </span>
        </div>
        <div className="bg-card rounded-xl border border-dashed border-border p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground font-mono mb-1">
            Trạng thái xử lý
          </p>
          <Badge variant="outline" className="text-xs font-bold uppercase">
            {VI.debt.statuses[debt.status]}
          </Badge>
        </div>
      </div>

      {/* ── 8/4 grid ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left (8 cols) — tabbed */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="bg-card rounded-xl shadow-sm border border-dashed border-border overflow-hidden">
            {/* Tab strip */}
            <div className="flex border-b border-dashed border-border px-6">
              {(
                [
                  { key: 'info', label: 'Thông tin' },
                  { key: 'history', label: 'Lịch sử thu' },
                  { key: 'links', label: 'Liên kết' },
                  { key: 'notes', label: 'Ghi chú' },
                ] as { key: ActiveTab; label: string }[]
              ).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`px-4 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === t.key
                      ? 'font-bold text-primary border-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab body */}
            <div className="p-6">
              {activeTab === 'info' && (
                <div className="grid grid-cols-2 gap-y-6 gap-x-10">
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                      {VI.debt.amount}
                    </p>
                    <p className="text-sm font-bold text-[var(--color-status-err)] font-mono">
                      {formatMoney(debt.totalAmount)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                      {VI.debt.paidAmount}
                    </p>
                    <p className="text-sm font-bold text-[var(--color-status-ok)] font-mono">
                      {formatMoney(debt.paidAmount)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                      Còn lại
                    </p>
                    <p className="text-sm font-bold font-mono">{formatMoney(remaining)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                      Phân nhóm
                    </p>
                    <Badge className="bg-[var(--color-status-err)]/10 text-[var(--color-status-err)] text-xs font-bold uppercase">
                      {VI.debt.tiers[debt.tier]}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                      {VI.contact.assignedTo}
                    </p>
                    <p className="text-sm font-medium">{debt.assignedTo?.fullName ?? '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                      {VI.contact.createdAt}
                    </p>
                    <p className="text-sm font-medium font-mono">
                      {format(new Date(debt.createdAt), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                  {debt.contact && (
                    <div
                      className="col-span-2 p-3 rounded-lg border border-dashed border-border hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => navigate(`/contacts/${debt.contact!.id}`)}
                    >
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-2">
                        Khách hàng
                      </p>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-accent/30 border border-dashed border-border flex items-center justify-center text-xs font-bold text-primary font-mono">
                          {initials(debt.contact.fullName)}
                        </div>
                        <div>
                          <p className="text-sm font-bold">{debt.contact.fullName}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {fmtPhone(debt.contact.phone)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'history' && (
                <p className="text-sm text-muted-foreground text-center py-6">Chưa có lịch sử thu</p>
              )}
              {activeTab === 'links' && (
                <p className="text-sm text-muted-foreground text-center py-6">Chưa có liên kết</p>
              )}
              {activeTab === 'notes' && (
                <p className="text-sm text-muted-foreground text-center py-6">Chưa có ghi chú</p>
              )}
            </div>
          </div>
        </div>

        {/* Right rail (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Action stack */}
          <DottedCard>
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
              Thao tác nhanh
            </h3>
            <div className="space-y-2.5">
              {debt.contact?.phone && (
                <div className="w-full">
                  <ClickToCallButton phone={debt.contact.phone} contactName={customerName} />
                </div>
              )}
              <Button
                variant="outline"
                className="w-full h-11 border-dashed font-bold text-sm gap-2"
                onClick={() => navigate('/tickets')}
              >
                <FileText className="h-4 w-4" />
                Tạo phiếu ghi
              </Button>
              <Button
                className="w-full h-11 bg-primary hover:bg-primary/90 font-bold text-sm gap-2"
                onClick={() => setPtpOpen(true)}
              >
                <Calendar className="h-4 w-4" />
                Cập nhật ngày hứa thanh toán
              </Button>
            </div>
          </DottedCard>

          {/* Activity timeline */}
          <DottedCard className="flex-1">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-6">
              Dòng thời gian
            </h3>
            <div className="relative space-y-8 before:content-[''] before:absolute before:left-4 before:top-2 before:bottom-0 before:w-px before:border-l before:border-dashed before:border-border">
              <div className="relative pl-10">
                <div className="absolute left-1.5 top-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center ring-2 ring-background">
                  <Edit2 className="h-2.5 w-2.5 text-white" />
                </div>
                <p className="text-xs font-bold text-foreground">Cập nhật trạng thái</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  → <span className="text-primary">{VI.debt.statuses[debt.status]}</span>
                </p>
                <p className="text-[10px] text-muted-foreground font-mono mt-1">
                  {format(new Date(debt.updatedAt), 'HH:mm - dd/MM/yyyy')}
                </p>
              </div>
              <div className="relative pl-10">
                <div className="absolute left-1.5 top-1 w-5 h-5 rounded-full bg-accent border border-dashed border-border flex items-center justify-center ring-2 ring-background">
                  <Phone className="h-2.5 w-2.5 text-primary" />
                </div>
                <p className="text-xs font-bold text-foreground">Hồ sơ được tạo</p>
                <p className="text-[10px] text-muted-foreground font-mono mt-1">
                  {format(new Date(debt.createdAt), 'HH:mm - dd/MM/yyyy')}
                </p>
              </div>
            </div>
          </DottedCard>
        </div>
      </div>

      {/* PTP Dialog */}
      <Dialog open={ptpOpen} onOpenChange={setPtpOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-primary font-bold">{VI.debt.ptpTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-widest font-mono text-muted-foreground">
                {VI.debt.promiseDate}
              </Label>
              <Input type="date" value={promiseDate} onChange={(e) => setPromiseDate(e.target.value)} required className="h-[42px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-widest font-mono text-muted-foreground">
                {VI.debt.promiseAmount}
              </Label>
              <Input type="number" min={0} value={promiseAmount} onChange={(e) => setPromiseAmount(e.target.value)} required className="h-[42px]" />
            </div>
          </div>
          <DialogFooter className="pt-2 border-t border-dashed border-border">
            <Button variant="outline" className="border-dashed" onClick={() => setPtpOpen(false)}>
              {VI.actions.cancel}
            </Button>
            <Button
              onClick={() => ptpMutation.mutate()}
              disabled={ptpMutation.isPending || !promiseDate || !promiseAmount}
              className="bg-primary hover:bg-primary/90"
            >
              {ptpMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {VI.actions.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
