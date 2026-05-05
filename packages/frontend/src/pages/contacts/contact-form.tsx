import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { VI } from '@/lib/vi-text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import api from '@/services/api-client';
import { PROVINCES, DISTRICTS } from '@/lib/vietnam-provinces';

interface Contact {
  id: string;
  fullName: string;
  phone: string;
  phoneAlt?: string;
  email?: string;
  tags?: string[];
  gender?: 'male' | 'female' | 'other';
  dateOfBirth?: string;
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

type GenderValue = 'male' | 'female' | 'other' | '';

interface FormState {
  fullName: string;
  phone: string;
  phoneAlt: string;
  email: string;
  tags: string;
  gender: GenderValue;
  dateOfBirth: string;
  occupation: string;
  income: string;
  province: string;
  district: string;
  fullAddress: string;
  company: string;
  jobTitle: string;
  companyEmail: string;
  creditLimit: string;
  bankAccount: string;
  bankName: string;
  internalNotes: string;
}

const EMPTY_FORM: FormState = {
  fullName: '', phone: '', phoneAlt: '', email: '', tags: '',
  gender: '', dateOfBirth: '',
  occupation: '', income: '',
  province: '', district: '', fullAddress: '',
  company: '', jobTitle: '', companyEmail: '',
  creditLimit: '', bankAccount: '', bankName: '',
  internalNotes: '',
};

function toFormState(c: Contact): FormState {
  return {
    fullName: c.fullName ?? '',
    phone: c.phone ?? '',
    phoneAlt: c.phoneAlt ?? '',
    email: c.email ?? '',
    tags: c.tags?.join(', ') ?? '',
    gender: (c.gender as GenderValue) ?? '',
    dateOfBirth: c.dateOfBirth ? c.dateOfBirth.slice(0, 10) : '',
    occupation: c.occupation ?? '',
    income: c.income != null ? String(c.income) : '',
    province: c.province ?? '',
    district: c.district ?? '',
    fullAddress: c.fullAddress ?? '',
    company: c.company ?? '',
    jobTitle: c.jobTitle ?? '',
    companyEmail: c.companyEmail ?? '',
    creditLimit: c.creditLimit != null ? String(c.creditLimit) : '',
    bankAccount: c.bankAccount ?? '',
    bankName: c.bankName ?? '',
    internalNotes: c.internalNotes ?? '',
  };
}

function Field({
  label, required, error, children,
}: {
  label: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className={`text-[10px] font-bold uppercase tracking-widest font-mono ${error ? 'text-destructive' : 'text-muted-foreground'}`}>
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono border-b border-dashed border-border pb-2 mb-3">
      {title}
    </h3>
  );
}

const selectClass = 'flex h-[42px] w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

export function ContactForm({ open, onClose, contact }: ContactFormProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => {
    setForm(contact ? toFormState(contact) : EMPTY_FORM);
    setErrors({});
  }, [contact, open]);

  const districtOptions = form.province ? (DISTRICTS[form.province] ?? []) : [];

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
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message
        || err?.response?.data?.errors?.map((e: any) => `${e.path}: ${e.message}`).join(', ')
        || 'Lưu thất bại';
      toast.error(msg);
    },
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

    // Find province/district names for submission
    const provinceName = PROVINCES.find((p) => p.code === form.province)?.name ?? form.province;
    const districtName = districtOptions.find((d) => d.code === form.district)?.name ?? form.district;

    const payload: Record<string, unknown> = {
      fullName: form.fullName,
      phone: form.phone,
      ...(form.phoneAlt && { phoneAlt: form.phoneAlt }),
      ...(form.email && { email: form.email }),
      ...(form.gender && { gender: form.gender }),
      ...(form.dateOfBirth && { dateOfBirth: new Date(form.dateOfBirth).toISOString() }),
      ...(form.tags && { tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean) }),
      ...(form.occupation && { occupation: form.occupation }),
      ...(form.income ? { income: Number(form.income) } : {}),
      ...(form.province && { province: provinceName }),
      ...(form.district && { district: districtName }),
      ...(form.fullAddress && { fullAddress: form.fullAddress }),
      ...(form.company && { company: form.company }),
      ...(form.jobTitle && { jobTitle: form.jobTitle }),
      ...(form.companyEmail && { companyEmail: form.companyEmail }),
      ...(form.creditLimit ? { creditLimit: Number(form.creditLimit) } : {}),
      ...(form.bankAccount && { bankAccount: form.bankAccount }),
      ...(form.bankName && { bankName: form.bankName }),
      ...(form.internalNotes && { internalNotes: form.internalNotes }),
    };
    mutation.mutate(payload);
  }

  function handleChange(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };
  }

  function handleProvinceChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, province: e.target.value, district: '' }));
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] w-[95vw] max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle>{contact ? VI.contact.editTitle : VI.contact.createTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 pt-2">

          {/* Thông tin cơ bản */}
          <div>
            <SectionTitle title={VI.contact.sections.basic} />
            <div className="grid grid-cols-3 gap-4">
              <Field label={VI.contact.fullName} required error={errors.fullName}>
                <Input value={form.fullName} onChange={handleChange('fullName')} placeholder="Nguyễn Văn A" />
              </Field>
              <Field label={VI.contact.phone} required error={errors.phone}>
                <Input value={form.phone} onChange={handleChange('phone')} placeholder="0901234567" />
              </Field>
              <Field label={VI.contact.phoneAlt}>
                <Input value={form.phoneAlt} onChange={handleChange('phoneAlt')} placeholder="0901234568" />
              </Field>
              <Field label={VI.contact.email}>
                <Input type="email" value={form.email} onChange={handleChange('email')} placeholder="email@example.com" />
              </Field>
              <Field label={VI.contact.gender}>
                <select
                  className={selectClass}
                  value={form.gender}
                  onChange={handleChange('gender')}
                >
                  <option value="">(trống)</option>
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                  <option value="other">Khác</option>
                </select>
              </Field>
              <Field label={VI.contact.dateOfBirth}>
                <Input type="date" value={form.dateOfBirth} onChange={handleChange('dateOfBirth')} />
              </Field>
              <Field label={VI.contact.tags}>
                <Input value={form.tags} onChange={handleChange('tags')} placeholder="VIP, Khách cũ" />
              </Field>
            </div>
          </div>

          {/* Công việc */}
          <div>
            <SectionTitle title={VI.contact.sections.work} />
            <div className="grid grid-cols-3 gap-4">
              <Field label={VI.contact.company}>
                <Input value={form.company} onChange={handleChange('company')} />
              </Field>
              <Field label={VI.contact.jobTitle}>
                <Input value={form.jobTitle} onChange={handleChange('jobTitle')} />
              </Field>
              <Field label={VI.contact.companyEmail}>
                <Input type="email" value={form.companyEmail} onChange={handleChange('companyEmail')} />
              </Field>
              <Field label={VI.contact.occupation}>
                <Input value={form.occupation} onChange={handleChange('occupation')} />
              </Field>
              <Field label={VI.contact.income}>
                <Input type="number" value={form.income} onChange={handleChange('income')} placeholder="" />
              </Field>
            </div>
          </div>

          {/* Địa chỉ */}
          <div>
            <SectionTitle title={VI.contact.sections.address} />
            <div className="grid grid-cols-3 gap-4">
              <Field label={VI.contact.province}>
                <select
                  className={selectClass}
                  value={form.province}
                  onChange={handleProvinceChange}
                >
                  <option value="">(trống)</option>
                  {PROVINCES.map((p) => (
                    <option key={p.code} value={p.code}>{p.name}</option>
                  ))}
                </select>
              </Field>
              <Field label={VI.contact.district}>
                <select
                  className={selectClass}
                  value={form.district}
                  onChange={handleChange('district')}
                  disabled={districtOptions.length === 0}
                >
                  <option value="">(trống)</option>
                  {districtOptions.map((d) => (
                    <option key={d.code} value={d.code}>{d.name}</option>
                  ))}
                </select>
              </Field>
              <div className="col-span-3">
                <Field label={VI.contact.fullAddress}>
                  <Textarea value={form.fullAddress} onChange={handleChange('fullAddress')} rows={2} />
                </Field>
              </div>
            </div>
          </div>

          {/* Tài chính */}
          <div>
            <SectionTitle title={VI.contact.sections.finance} />
            <div className="grid grid-cols-3 gap-4">
              <Field label={VI.contact.creditLimit}>
                <Input type="number" value={form.creditLimit} onChange={handleChange('creditLimit')} placeholder="" />
              </Field>
              <Field label={VI.contact.bankAccount}>
                <Input value={form.bankAccount} onChange={handleChange('bankAccount')} />
              </Field>
              <Field label={VI.contact.bankName}>
                <Input value={form.bankName} onChange={handleChange('bankName')} />
              </Field>
            </div>
          </div>

          {/* Ghi chú */}
          <div>
            <SectionTitle title={VI.contact.sections.notes} />
            <div className="grid grid-cols-1 gap-4">
              <Field label={VI.contact.internalNotes}>
                <Textarea value={form.internalNotes} onChange={handleChange('internalNotes')} rows={3} />
              </Field>
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-dashed border-border">
            <Button type="button" variant="outline" className="border-dashed" onClick={onClose}>{VI.actions.cancel}</Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-primary hover:bg-primary/90">
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {VI.actions.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
