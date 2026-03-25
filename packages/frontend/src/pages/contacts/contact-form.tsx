import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { VI } from '@/lib/vi-text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from '@/components/ui/sheet';
import { Loader2 } from 'lucide-react';
import api from '@/services/api-client';

interface Contact {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  tags?: string[];
  notes?: string;
}

interface ContactFormProps {
  open: boolean;
  onClose: () => void;
  contact?: Contact;
}

interface FormState {
  fullName: string;
  phone: string;
  email: string;
  tags: string;
  notes: string;
}

const EMPTY_FORM: FormState = { fullName: '', phone: '', email: '', tags: '', notes: '' };

export function ContactForm({ open, onClose, contact }: ContactFormProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<FormState>>({});

  useEffect(() => {
    if (contact) {
      setForm({
        fullName: contact.fullName,
        phone: contact.phone,
        email: contact.email || '',
        tags: contact.tags?.join(', ') || '',
        notes: contact.notes || '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setErrors({});
  }, [contact, open]);

  const mutation = useMutation({
    mutationFn: (payload: Omit<FormState, 'tags'> & { tags: string[] }) =>
      contact
        ? api.patch(`/contacts/${contact.id}`, payload)
        : api.post('/contacts', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success(contact ? 'Đã cập nhật liên hệ' : 'Đã tạo liên hệ');
      onClose();
    },
    onError: () => toast.error('Lưu thất bại'),
  });

  function validate(): boolean {
    const errs: Partial<FormState> = {};
    if (!form.fullName.trim()) errs.fullName = 'Vui lòng nhập họ tên';
    if (!form.phone.trim()) errs.phone = 'Vui lòng nhập số điện thoại';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    mutation.mutate({
      ...form,
      tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    });
  }

  function handleChange(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };
  }

  const title = contact ? VI.contact.editTitle : VI.contact.createTitle;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-1">
            <Label htmlFor="fullName">{VI.contact.fullName} *</Label>
            <Input
              id="fullName"
              value={form.fullName}
              onChange={handleChange('fullName')}
              placeholder="Nguyễn Văn A"
            />
            {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="phone">{VI.contact.phone} *</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={handleChange('phone')}
              placeholder="0901234567"
            />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="email">{VI.contact.email}</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={handleChange('email')}
              placeholder="email@example.com"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="tags">{VI.contact.tags}</Label>
            <Input
              id="tags"
              value={form.tags}
              onChange={handleChange('tags')}
              placeholder="VIP, Khách cũ (phân cách bằng dấu phẩy)"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="notes">{VI.lead.notes}</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={handleChange('notes')}
              rows={3}
              placeholder="Ghi chú..."
            />
          </div>

          <SheetFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>{VI.actions.cancel}</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {VI.actions.save}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
