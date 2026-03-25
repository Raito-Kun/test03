import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { VI } from '@/lib/vi-text';
import api from '@/services/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';

const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
type TicketPriority = typeof TICKET_PRIORITIES[number];

interface TicketFormData {
  contactId: string;
  categoryId: string;
  priority: TicketPriority;
  content: string;
}

interface TicketFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  ticketId?: string;
  initialData?: Partial<TicketFormData>;
}

interface Category { id: string; name: string; }
interface Macro { id: string; name: string; content: string; }

export default function TicketForm({ open, onClose, onSuccess, ticketId, initialData }: TicketFormProps) {
  const isEdit = Boolean(ticketId);
  const [form, setForm] = useState<TicketFormData>({
    contactId: initialData?.contactId ?? '',
    categoryId: initialData?.categoryId ?? '',
    priority: initialData?.priority ?? 'medium',
    content: initialData?.content ?? '',
  });

  useEffect(() => {
    if (initialData) {
      setForm({
        contactId: initialData.contactId ?? '',
        categoryId: initialData.categoryId ?? '',
        priority: initialData.priority ?? 'medium',
        content: initialData.content ?? '',
      });
    }
  }, [initialData]);

  const { data: categories } = useQuery({
    queryKey: ['ticket-categories'],
    queryFn: async () => {
      const { data } = await api.get('/ticket-categories');
      return data.data as Category[];
    },
  });

  const { data: macros } = useQuery({
    queryKey: ['macros'],
    queryFn: async () => {
      const { data } = await api.get('/macros');
      return data.data as Macro[];
    },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: async (payload: TicketFormData) => {
      if (isEdit) {
        await api.patch(`/tickets/${ticketId}`, payload);
      } else {
        await api.post('/tickets', payload);
      }
    },
    onSuccess: () => {
      toast.success(VI.settings.saveSuccess);
      onSuccess();
    },
  });

  function handleMacroSelect(macroId: string) {
    const macro = macros?.find((m) => m.id === macroId);
    if (macro) setForm((f) => ({ ...f, content: macro.content }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutate(form);
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? VI.ticket.editTitle : VI.ticket.createTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{VI.contact.fullName} (ID)</Label>
            <Input
              value={form.contactId}
              onChange={(e) => setForm((f) => ({ ...f, contactId: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>{VI.ticket.category}</Label>
            <Select value={form.categoryId} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v ?? '' }))}>
              <SelectTrigger>
                <SelectValue placeholder={VI.ticket.category} />
              </SelectTrigger>
              <SelectContent>
                {categories?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{VI.ticket.priority}</Label>
            <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v as TicketPriority }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TICKET_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>{VI.ticket.priorities[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{VI.ticket.macro}</Label>
            <Select onValueChange={(v: string | null) => { if (v) handleMacroSelect(v); }}>
              <SelectTrigger>
                <SelectValue placeholder={VI.ticket.macro} />
              </SelectTrigger>
              <SelectContent>
                {macros?.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{VI.ticket.content}</Label>
            <Textarea
              rows={4}
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{VI.actions.cancel}</Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {VI.actions.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
