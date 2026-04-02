import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronDown, Loader2 } from 'lucide-react';
import { VI } from '@/lib/vi-text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from '@/components/ui/sheet';
import api from '@/services/api-client';

interface Contact {
  id: string;
  fullName: string;
  phone: string;
  phoneAlt?: string;
  email?: string;
  tags?: string[];
  notes?: string;
  occupation?: string;
  income?: string | number;
  province?: string;
  district?: string;
  fullAddress?: string;
  company?: string;
  jobTitle?: string;
  companyEmail?: string;
  creditLimit?: string | number;
  bankAccount?: string;
  bankName?: string;
  internalNotes?: string;
}

interface ContactFormProps {
  open: boolean;
  onClose: () => void;
  contact?: Contact;
}

interface FormState {
  fullName: string; phone: string; phoneAlt: string; email: string;
  tags: string; notes: string;
  occupation: string; income: string;
  province: string; district: string; fullAddress: string;
  company: string; jobTitle: string; companyEmail: string;
  creditLimit: string; bankAccount: string; bankName: string;
  internalNotes: string;
}

const EMPTY_FORM: FormState = {
  fullName: '', phone: '', phoneAlt: '', email: '', tags: '', notes: '',
  occupation: '', income: '', province: '', district: '', fullAddress: '',
  company: '', jobTitle: '', companyEmail: '', creditLimit: '',
  bankAccount: '', bankName: '', internalNotes: '',
};

function toFormState(c: Contact): FormState {
  return {
    fullName: c.fullName ?? '', phone: c.phone ?? '',
    phoneAlt: c.phoneAlt ?? '', email: c.email ?? '',
    tags: c.tags?.join(', ') ?? '', notes: c.notes ?? '',
    occupation: c.occupation ?? '',
    income: c.income != null ? String(c.income) : '',
    province: c.province ?? '', district: c.district ?? '',
    fullAddress: c.fullAddress ?? '', company: c.company ?? '',
    jobTitle: c.jobTitle ?? '', companyEmail: c.companyEmail ?? '',
    creditLimit: c.creditLimit != null ? String(c.creditLimit) : '',
    bankAccount: c.bankAccount ?? '', bankName: c.bankName ?? '',
    internalNotes: c.internalNotes ?? '',
  };
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Section({ title, children, defaultOpen = false }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center justify-between py-2 text-sm font-semibold border-b hover:text-primary transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        {title}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="space-y-3 pt-3 pb-1">{children}</div>}
    </div>
  );
}

export function ContactForm({ open, onClose, contact }: ContactFormProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => {
    setForm(contact ? toFormState(contact) : EMPTY_FORM);
    setErrors({});
  }, [contact, open]);

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      contact
        ? api.patch(`/contacts/${contact.id}`, payload)
        : api.post('/contacts', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      if (contact) queryClient.invalidateQueries({ queryKey: ['contact', contact.id] });
      toast.success(contact ? 'Đã cập nhật liên hệ' : 'Đã tạo liên hệ');
      onClose();
    },
    onError: () => toast.error('Lưu thất bại'),
  });

  function validate(): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {};
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
      income: form.income ? Number(form.income) : undefined,
      creditLimit: form.creditLimit ? Number(form.creditLimit) : undefined,
    });
  }

  function handleChange(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{contact ? VI.contact.editTitle : VI.contact.createTitle}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">

          {/* Basic — always open */}
          <Section title={VI.contact.sections.basic} defaultOpen>
            <div className="space-y-1">
              <Label htmlFor="fullName">{VI.contact.fullName} *</Label>
              <Input id="fullName" value={form.fullName} onChange={handleChange('fullName')} placeholder="Nguyễn Văn A" />
              {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone">{VI.contact.phone} *</Label>
              <Input id="phone" value={form.phone} onChange={handleChange('phone')} placeholder="0901234567" />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="phoneAlt">{VI.contact.phoneAlt}</Label>
              <Input id="phoneAlt" value={form.phoneAlt} onChange={handleChange('phoneAlt')} placeholder="0901234568" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">{VI.contact.email}</Label>
              <Input id="email" type="email" value={form.email} onChange={handleChange('email')} placeholder="email@example.com" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tags">{VI.contact.tags}</Label>
              <Input id="tags" value={form.tags} onChange={handleChange('tags')} placeholder="VIP, Khách cũ (phân cách bằng dấu phẩy)" />
            </div>
          </Section>

          {/* Work */}
          <Section title={VI.contact.sections.work}>
            <div className="space-y-1">
              <Label htmlFor="company">{VI.contact.company}</Label>
              <Input id="company" value={form.company} onChange={handleChange('company')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="jobTitle">{VI.contact.jobTitle}</Label>
              <Input id="jobTitle" value={form.jobTitle} onChange={handleChange('jobTitle')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="companyEmail">{VI.contact.companyEmail}</Label>
              <Input id="companyEmail" type="email" value={form.companyEmail} onChange={handleChange('companyEmail')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="occupation">{VI.contact.occupation}</Label>
              <Input id="occupation" value={form.occupation} onChange={handleChange('occupation')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="income">{VI.contact.income}</Label>
              <Input id="income" type="number" value={form.income} onChange={handleChange('income')} />
            </div>
          </Section>

          {/* Address */}
          <Section title={VI.contact.sections.address}>
            <div className="space-y-1">
              <Label htmlFor="province">{VI.contact.province}</Label>
              <Input id="province" value={form.province} onChange={handleChange('province')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="district">{VI.contact.district}</Label>
              <Input id="district" value={form.district} onChange={handleChange('district')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="fullAddress">{VI.contact.fullAddress}</Label>
              <Textarea id="fullAddress" value={form.fullAddress} onChange={handleChange('fullAddress')} rows={2} />
            </div>
          </Section>

          {/* Finance */}
          <Section title={VI.contact.sections.finance}>
            <div className="space-y-1">
              <Label htmlFor="creditLimit">{VI.contact.creditLimit}</Label>
              <Input id="creditLimit" type="number" value={form.creditLimit} onChange={handleChange('creditLimit')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bankAccount">{VI.contact.bankAccount}</Label>
              <Input id="bankAccount" value={form.bankAccount} onChange={handleChange('bankAccount')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bankName">{VI.contact.bankName}</Label>
              <Input id="bankName" value={form.bankName} onChange={handleChange('bankName')} />
            </div>
          </Section>

          {/* Notes */}
          <Section title={VI.contact.sections.notes}>
            <div className="space-y-1">
              <Label htmlFor="notes">{VI.lead.notes}</Label>
              <Textarea id="notes" value={form.notes} onChange={handleChange('notes')} rows={3} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="internalNotes">{VI.contact.internalNotes}</Label>
              <Textarea id="internalNotes" value={form.internalNotes} onChange={handleChange('internalNotes')} rows={3} />
            </div>
          </Section>

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
