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
  };
}

export default function LeadForm({ open, onClose, onSuccess, initialData }: LeadFormProps) {
  const isEdit = !!initialData;
  const [contactId, setContactId] = useState(initialData?.contactId ?? '');
  const [status, setStatus] = useState<LeadStatus>(initialData?.status ?? 'new');
  const [score, setScore] = useState(initialData?.score?.toString() ?? '');
  const [notes, setNotes] = useState(initialData?.notes ?? '');
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
          <DialogTitle>{isEdit ? VI.lead.editTitle : VI.lead.createTitle}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Contact ID</Label>
            <Input
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              placeholder="Contact ID"
            />
          </div>

          <div className="space-y-1">
            <Label>{VI.lead.status}</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as LeadStatus)}>
              <SelectTrigger>
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
            <Label>{VI.lead.score} (0-100)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={score}
              onChange={(e) => setScore(e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="space-y-1">
            <Label>{VI.lead.notes}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-1">
            <Label>{VI.lead.followUp}</Label>
            <Input
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{VI.actions.cancel}</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? VI.actions.loading : VI.actions.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
