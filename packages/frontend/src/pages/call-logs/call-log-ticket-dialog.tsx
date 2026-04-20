/**
 * Lightweight dialog to create a ticket from an answered call.
 * Opens from the call detail view; pre-fills subject/contactId/callLogId so the
 * agent only needs to pick category + priority + optional note.
 */
import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import api from '@/services/api-client';

interface CallCtx {
  callLogId: string;
  contactId: string | null;
  contactName: string | null;
  customerPhone: string;
  startTime: string;
}

interface Props {
  open: boolean;
  call: CallCtx | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface Category { id: string; name: string }

const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
const PRIORITY_VI: Record<string, string> = { low: 'Thấp', medium: 'Trung bình', high: 'Cao', urgent: 'Khẩn' };

function buildSubject(call: CallCtx): string {
  const who = call.contactName || call.customerPhone || 'khách hàng';
  const when = format(new Date(call.startTime), 'dd/MM HH:mm');
  return `Phiếu ghi cuộc gọi — ${who} — ${when}`;
}

export function CallLogTicketDialog({ open, call, onClose, onSuccess }: Props) {
  const [subject, setSubject] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priority, setPriority] = useState<typeof PRIORITIES[number]>('medium');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (call && open) {
      setSubject(buildSubject(call));
      setCategoryId('');
      setPriority('medium');
      setContent('');
    }
  }, [call, open]);

  const { data: categories = [] } = useQuery({
    queryKey: ['ticket-categories'],
    queryFn: () => api.get('/ticket-categories').then((r) => r.data.data as Category[]),
    enabled: open,
  });

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      if (!call) throw new Error('No call context');
      if (!call.contactId) {
        throw new Error('Cuộc gọi này chưa gắn với khách hàng — tạo liên hệ trước.');
      }
      await api.post('/tickets', {
        contactId: call.contactId,
        callLogId: call.callLogId,
        categoryId: categoryId || undefined,
        subject,
        content: content || undefined,
        priority,
      });
    },
    onSuccess: () => {
      toast.success('Đã tạo phiếu ghi');
      onSuccess();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || 'Lỗi tạo phiếu ghi'),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Tạo phiếu ghi từ cuộc gọi</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3 py-1"
          onSubmit={(e) => { e.preventDefault(); mutate(); }}
        >
          <div className="space-y-1">
            <Label className="text-xs">Tiêu đề</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Phân loại</Label>
              <Select value={categoryId || undefined} onValueChange={(v) => setCategoryId(v === '_none' || !v ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="— Chọn —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">— Không chọn —</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mức ưu tiên</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as typeof PRIORITIES[number])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>{PRIORITY_VI[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Ghi chú</Label>
            <Textarea rows={4} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Nội dung phiếu ghi (tùy chọn)..." />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>Hủy</Button>
            <Button type="submit" disabled={isPending || !subject.trim()}>
              {isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Lưu phiếu ghi
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
