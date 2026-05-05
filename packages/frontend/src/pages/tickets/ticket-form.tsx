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

// Priority dot colors matching ticket-card.tsx
const PRIORITY_DOTS: Record<TicketPriority, string> = {
  low: 'bg-muted-foreground/40',
  medium: 'bg-primary',
  high: 'bg-amber-500',
  urgent: 'bg-destructive',
};

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

/** Mono uppercase field label — consistent with M3 lavender design system */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
      {children}
    </Label>
  );
}

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
        <DialogHeader className="border-b border-dashed border-border pb-4">
          <DialogTitle className="font-mono text-base">
            {isEdit ? VI.ticket.editTitle : VI.ticket.createTitle}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-1">
          {/* ── Contact ID section ── */}
          <div className="space-y-1.5">
            <FieldLabel>{VI.contact.fullName} (ID)</FieldLabel>
            <Input
              className="h-[42px]"
              value={form.contactId}
              onChange={(e) => setForm((f) => ({ ...f, contactId: e.target.value }))}
              required
            />
          </div>

          <div className="border-t border-dashed border-border" />

          {/* ── Classification section ── */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <FieldLabel>{VI.ticket.category}</FieldLabel>
              <Select value={form.categoryId} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v ?? '' }))}>
                <SelectTrigger className="h-[42px] font-mono text-sm">
                  <SelectValue placeholder={VI.ticket.category} />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id} className="font-mono text-sm">
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>{VI.ticket.priority}</FieldLabel>
              <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v as TicketPriority }))}>
                <SelectTrigger className="h-[42px]">
                  <SelectValue>
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOTS[form.priority]}`} />
                      {VI.ticket.priorities[form.priority]}
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TICKET_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOTS[p]}`} />
                        {VI.ticket.priorities[p]}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border-t border-dashed border-border" />

          {/* ── Content section ── */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <FieldLabel>{VI.ticket.macro}</FieldLabel>
              <Select onValueChange={(v: string | null) => { if (v) handleMacroSelect(v); }}>
                <SelectTrigger className="h-[42px] font-mono text-sm">
                  <SelectValue placeholder={VI.ticket.macro} />
                </SelectTrigger>
                <SelectContent>
                  {macros?.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="font-mono text-sm">
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <FieldLabel>{VI.ticket.content}</FieldLabel>
              <Textarea
                rows={4}
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                required
                className="border-dashed resize-none"
              />
            </div>
          </div>

          <DialogFooter className="border-t border-dashed border-border pt-4 gap-2">
            <Button type="button" variant="outline" className="border-dashed" onClick={onClose}>
              {VI.actions.cancel}
            </Button>
            <Button type="submit" disabled={isPending} className="bg-primary text-primary-foreground shadow-md shadow-primary/20 min-w-[80px]">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {VI.actions.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
