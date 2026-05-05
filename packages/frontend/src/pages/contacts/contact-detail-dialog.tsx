import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Edit2, X, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
// All sections displayed in single scrollable view — no tabs
import { Skeleton } from '@/components/ui/skeleton';
import { ClickToCallButton } from '@/components/click-to-call-button';
import { VI } from '@/lib/vi-text';
import { fmtPhone } from '@/lib/format';
import api from '@/services/api-client';
import { PROVINCES, DISTRICTS } from '@/lib/vietnam-provinces';
import { CallHistoryTab } from './call-history-tab';

interface Contact {
  id: string;
  fullName: string;
  phone: string;
  phoneAlt?: string;
  email?: string;
  gender?: string;
  dateOfBirth?: string;
  idNumber?: string;
  address?: string;
  source?: string;
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
  assignedTo?: string;
  createdAt: string;
}

interface EditForm {
  fullName: string;
  phone: string;
  phoneAlt: string;
  email: string;
  gender: string;
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
  notes: string;
}

function toFormState(c: Contact): EditForm {
  // Reverse-map province/district names to codes for select dropdowns
  const provinceCode = PROVINCES.find((p) => p.name === c.province)?.code ?? c.province ?? '';
  const districtList = provinceCode ? (DISTRICTS[provinceCode] ?? []) : [];
  const districtCode = districtList.find((d) => d.name === c.district)?.code ?? c.district ?? '';
  return {
    fullName: c.fullName ?? '',
    phone: c.phone ?? '',
    phoneAlt: c.phoneAlt ?? '',
    email: c.email ?? '',
    gender: c.gender ?? '',
    dateOfBirth: c.dateOfBirth ? c.dateOfBirth.substring(0, 10) : '',
    occupation: c.occupation ?? '',
    income: c.income != null ? String(c.income) : '',
    province: provinceCode,
    district: districtCode,
    fullAddress: c.fullAddress ?? '',
    company: c.company ?? '',
    jobTitle: c.jobTitle ?? '',
    companyEmail: c.companyEmail ?? '',
    creditLimit: c.creditLimit != null ? String(c.creditLimit) : '',
    bankAccount: c.bankAccount ?? '',
    bankName: c.bankName ?? '',
    internalNotes: c.internalNotes ?? '',
    notes: (c as unknown as Record<string, string>).notes ?? '',
  };
}

interface FieldProps {
  label: string;
  value?: string;
  edit: boolean;
  field: keyof EditForm;
  form: EditForm;
  onChange: (field: keyof EditForm, val: string) => void;
  type?: string;
  multiline?: boolean;
}

const selectClass = 'flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

function Field({ label, value, edit, field, form, onChange, type = 'text', multiline }: FieldProps) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground font-mono">{label}</Label>
      {edit ? (
        multiline ? (
          <Textarea
            value={form[field]}
            onChange={(e) => onChange(field, e.target.value)}
            rows={3}
            className="text-sm"
          />
        ) : (
          <Input
            type={type}
            value={form[field]}
            onChange={(e) => onChange(field, e.target.value)}
            className="h-[42px] text-sm"
          />
        )
      ) : (
        <p className="text-sm font-medium">{value || '—'}</p>
      )}
    </div>
  );
}

function SelectField({ label, displayValue, edit, field, form, onChange, options }: {
  label: string; displayValue?: string; edit: boolean; field: keyof EditForm;
  form: EditForm; onChange: (field: keyof EditForm, val: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground font-mono">{label}</Label>
      {edit ? (
        <select className={selectClass} value={form[field]} onChange={(e) => onChange(field, e.target.value)}>
          <option value="">(trống)</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <p className="text-sm font-medium">{displayValue || '—'}</p>
      )}
    </div>
  );
}

interface Props {
  contactId: string | null;
  onClose: () => void;
}

export function ContactDetailDialog({ contactId, onClose }: Props) {
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);

  const { data: contact, isLoading } = useQuery({
    queryKey: ['contact', contactId],
    queryFn: () =>
      api.get<{ data: Contact }>(`/contacts/${contactId}`).then((r) => r.data.data),
    enabled: !!contactId,
    select: (data) => {
      if (!form) setForm(toFormState(data));
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.patch(`/contacts/${contactId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', contactId] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Đã cập nhật liên hệ');
      setEditMode(false);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message
        || err?.response?.data?.errors?.map((e: any) => `${e.path}: ${e.message}`).join(', ')
        || 'Cập nhật thất bại';
      toast.error(msg);
    },
  });

  function handleChange(field: keyof EditForm, val: string) {
    if (field === 'province') {
      setForm((prev) => prev ? { ...prev, province: val, district: '' } : prev);
    } else {
      setForm((prev) => prev ? { ...prev, [field]: val } : prev);
    }
  }

  function handleSave() {
    if (!form) return;
    // Map province/district codes to names
    const districtOptions = form.province ? (DISTRICTS[form.province] ?? []) : [];
    const provinceName = PROVINCES.find((p) => p.code === form.province)?.name ?? form.province;
    const districtName = districtOptions.find((d) => d.code === form.district)?.name ?? form.district;
    // Build payload — only include non-empty fields to avoid Zod enum validation failures
    const payload: Record<string, unknown> = {
      fullName: form.fullName,
      phone: form.phone,
      ...(form.phoneAlt && { phoneAlt: form.phoneAlt }),
      ...(form.email && { email: form.email }),
      ...(form.gender && { gender: form.gender }),
      ...(form.dateOfBirth && { dateOfBirth: new Date(form.dateOfBirth).toISOString() }),
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

  function handleEditToggle() {
    if (editMode) {
      // cancel — reset form
      if (contact) setForm(toFormState(contact));
      setEditMode(false);
    } else {
      if (contact) setForm(toFormState(contact));
      setEditMode(true);
    }
  }

  const isOpen = !!contactId;
  const f = form ?? ({} as EditForm);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { setEditMode(false); onClose(); } }}>
      <DialogContent className="sm:max-w-[900px] w-[95vw] max-h-[90vh] overflow-y-auto !top-[5vh] !-translate-y-0">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="flex items-center gap-2">
              {isLoading ? <Skeleton className="h-6 w-40" /> : (contact?.fullName ?? '—')}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {editMode ? (
                <>
                  <Button size="sm" variant="outline" onClick={handleEditToggle}>
                    <X className="mr-1 h-3.5 w-3.5" /> {VI.actions.cancel}
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={mutation.isPending}>
                    {mutation.isPending
                      ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      : <Save className="mr-1 h-3.5 w-3.5" />}
                    {VI.actions.save}
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={handleEditToggle}>
                  <Edit2 className="mr-1 h-3.5 w-3.5" /> {VI.actions.edit}
                </Button>
              )}
              {contact && (
                <ClickToCallButton
                  phone={contact.phone}
                  contactName={contact.fullName}
                  size="default"
                  variant="default"
                />
              )}
            </div>
          </div>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-3 py-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        )}

        {contact && (
          <div className="space-y-6 mt-2">
            {/* Basic info */}
            <section>
              <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 pb-2 border-b border-dashed border-border">
                {VI.contact.sections.basic}
              </h3>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <Field label={VI.contact.fullName} value={contact.fullName} edit={editMode} field="fullName" form={f} onChange={handleChange} />
                <Field label={VI.contact.phone} value={fmtPhone(contact.phone)} edit={editMode} field="phone" form={f} onChange={handleChange} />
                <Field label={VI.contact.phoneAlt} value={fmtPhone(contact.phoneAlt)} edit={editMode} field="phoneAlt" form={f} onChange={handleChange} />
                <Field label={VI.contact.email} value={contact.email} edit={editMode} field="email" form={f} onChange={handleChange} type="email" />
                <SelectField
                  label={VI.contact.gender}
                  displayValue={contact.gender === 'male' ? 'Nam' : contact.gender === 'female' ? 'Nữ' : contact.gender === 'other' ? 'Khác' : contact.gender}
                  edit={editMode}
                  field="gender"
                  form={f}
                  onChange={handleChange}
                  options={[{ value: 'male', label: 'Nam' }, { value: 'female', label: 'Nữ' }, { value: 'other', label: 'Khác' }]}
                />
                <Field
                  label={VI.contact.dateOfBirth}
                  value={contact.dateOfBirth ? format(new Date(contact.dateOfBirth), 'dd/MM/yyyy') : undefined}
                  edit={editMode}
                  field="dateOfBirth"
                  form={f}
                  onChange={handleChange}
                  type="date"
                />
              </div>
            </section>

            {/* Work */}
            <section>
              <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 pb-2 border-b border-dashed border-border">
                {VI.contact.sections.work}
              </h3>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <Field label={VI.contact.company} value={contact.company} edit={editMode} field="company" form={f} onChange={handleChange} />
                <Field label={VI.contact.jobTitle} value={contact.jobTitle} edit={editMode} field="jobTitle" form={f} onChange={handleChange} />
                <Field label={VI.contact.companyEmail} value={contact.companyEmail} edit={editMode} field="companyEmail" form={f} onChange={handleChange} type="email" />
                <Field label={VI.contact.occupation} value={contact.occupation} edit={editMode} field="occupation" form={f} onChange={handleChange} />
                <Field label={VI.contact.income} value={contact.income != null ? String(contact.income) : undefined} edit={editMode} field="income" form={f} onChange={handleChange} type="number" />
              </div>
            </section>

            {/* Address */}
            <section>
              <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 pb-2 border-b border-dashed border-border">
                {VI.contact.sections.address}
              </h3>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <SelectField
                  label={VI.contact.province}
                  displayValue={contact.province}
                  edit={editMode}
                  field="province"
                  form={f}
                  onChange={handleChange}
                  options={PROVINCES.map((p) => ({ value: p.code, label: p.name }))}
                />
                <SelectField
                  label={VI.contact.district}
                  displayValue={contact.district}
                  edit={editMode}
                  field="district"
                  form={f}
                  onChange={handleChange}
                  options={(DISTRICTS[f.province] ?? []).map((d) => ({ value: d.code, label: d.name }))}
                />
                <div className="col-span-2 md:col-span-3">
                  <Field label={VI.contact.fullAddress} value={contact.fullAddress} edit={editMode} field="fullAddress" form={f} onChange={handleChange} multiline />
                </div>
              </div>
            </section>

            {/* Finance */}
            <section>
              <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 pb-2 border-b border-dashed border-border">
                {VI.contact.sections.finance}
              </h3>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <Field label={VI.contact.creditLimit} value={contact.creditLimit != null ? String(contact.creditLimit) : undefined} edit={editMode} field="creditLimit" form={f} onChange={handleChange} type="number" />
                <Field label={VI.contact.bankAccount} value={contact.bankAccount} edit={editMode} field="bankAccount" form={f} onChange={handleChange} />
                <Field label={VI.contact.bankName} value={contact.bankName} edit={editMode} field="bankName" form={f} onChange={handleChange} />
              </div>
            </section>

            {/* Notes */}
            <section>
              <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 pb-2 border-b border-dashed border-border">
                {VI.contact.sections.notes}
              </h3>
              <div className="space-y-4">
                <Field label={VI.contact.internalNotes} value={contact.internalNotes} edit={editMode} field="internalNotes" form={f} onChange={handleChange} multiline />
                <Field label={VI.lead.notes} value={(contact as unknown as Record<string, string>).notes} edit={editMode} field="notes" form={f} onChange={handleChange} multiline />
              </div>
            </section>

            {/* Call History */}
            <section>
              <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 pb-2 border-b border-dashed border-border">
                Lịch sử cuộc gọi
              </h3>
              <CallHistoryTab contactId={contactId!} phone={contact.phone} />
            </section>

            {/* Footer */}
            <div className="text-xs text-muted-foreground border-t border-dashed border-border pt-2">
              <p className="font-mono">{VI.contact.createdAt}: {format(new Date(contact.createdAt), 'dd/MM/yyyy HH:mm')}</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
