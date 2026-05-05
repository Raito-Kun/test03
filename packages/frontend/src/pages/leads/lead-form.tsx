import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/services/api-client';
import { VI } from '@/lib/vi-text';
import { LEAD_STATUSES, type LeadStatus } from '@shared/constants/enums';
import { toast } from 'sonner';

const LEAD_SOURCES = [
  { value: 'website', label: 'Website' },
  { value: 'referral', label: 'Giới thiệu' },
  { value: 'phone', label: 'Điện thoại' },
  { value: 'email', label: 'Email' },
  { value: 'social', label: 'Mạng xã hội' },
  { value: 'other', label: 'Khác' },
] as const;

interface LeadFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: {
    id: string;
    contactId: string;
    status: LeadStatus;
    score: number | null;
    notes: string | null;
    followUpDate: string | null;
    source?: string | null;
  };
}

export default function LeadForm({ open, onClose, onSuccess, initialData }: LeadFormProps) {
  const isEdit = !!initialData;
  const [contactId, setContactId] = useState(initialData?.contactId ?? '');
  const [status, setStatus] = useState<LeadStatus>(initialData?.status ?? 'new');
  const [score, setScore] = useState(initialData?.score?.toString() ?? '');
  const [notes, setNotes] = useState(initialData?.notes ?? '');
  const [source, setSource] = useState(initialData?.source ?? '');
  const [followUpDate, setFollowUpDate] = useState(
    initialData?.followUpDate ? initialData.followUpDate.substring(0, 10) : ''
  );

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        contactId: contactId || undefined,
        status,
        score: score ? Number(score) : undefined,
        notes: notes || undefined,
        followUpDate: followUpDate || undefined,
        source: source || undefined,
      };
      if (isEdit) {
        await api.patch(`/leads/${initialData.id}`, payload);
      } else {
        await api.post('/leads', payload);
      }
    },
    onSuccess: () => {
      toast.success(VI.settings.saveSuccess);
      onSuccess();
    },
    onError: () => {
      toast.error('Lỗi khi lưu lead');
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-primary font-bold">
            {isEdit ? VI.lead.editTitle : VI.lead.createTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Thông tin cơ bản */}
          <div>
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono border-b border-dashed border-border pb-2 mb-3">
              Thông tin lead
            </h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase tracking-widest font-mono text-muted-foreground">
                  Mã liên hệ
                </Label>
                <Input
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  placeholder="Mã liên hệ"
                  className="h-[42px]"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase tracking-widest font-mono text-muted-foreground">
                  {VI.lead.status}
                </Label>
                <Select value={status} onValueChange={(v) => setStatus(v as LeadStatus)}>
                  <SelectTrigger className="h-[42px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{VI.lead.statuses[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase tracking-widest font-mono text-muted-foreground">
                  Nguồn
                </Label>
                <Select value={source || undefined} onValueChange={(v) => setSource(v === '_none' ? '' : v || '')}>
                  <SelectTrigger className="h-[42px]">
                    {source
                      ? <span>{LEAD_SOURCES.find((s) => s.value === source)?.label || source}</span>
                      : <SelectValue placeholder="Chọn nguồn" />}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— Không có —</SelectItem>
                    {LEAD_SOURCES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Đánh giá */}
          <div>
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono border-b border-dashed border-border pb-2 mb-3">
              Đánh giá &amp; theo dõi
            </h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase tracking-widest font-mono text-muted-foreground">
                  {VI.lead.score} (0–100)
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  placeholder="0"
                  className="h-[42px]"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase tracking-widest font-mono text-muted-foreground">
                  {VI.lead.followUp}
                </Label>
                <Input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="h-[42px]"
                />
              </div>
            </div>
          </div>

          {/* Ghi chú */}
          <div>
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono border-b border-dashed border-border pb-2 mb-3">
              Ghi chú
            </h3>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-widest font-mono text-muted-foreground">
                {VI.lead.notes}
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2 border-t border-dashed border-border">
          <Button variant="outline" className="border-dashed" onClick={onClose}>
            {VI.actions.cancel}
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="bg-primary hover:bg-primary/90"
          >
            {mutation.isPending ? VI.actions.loading : VI.actions.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
