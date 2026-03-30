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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ClickToCallButton } from '@/components/click-to-call-button';
import { VI } from '@/lib/vi-text';
import { fmtPhone } from '@/lib/format';
import api from '@/services/api-client';

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
  return {
    fullName: c.fullName ?? '',
    phone: c.phone ?? '',
    phoneAlt: c.phoneAlt ?? '',
    email: c.email ?? '',
    gender: c.gender ?? '',
    dateOfBirth: c.dateOfBirth ? c.dateOfBirth.substring(0, 10) : '',
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

function Field({ label, value, edit, field, form, onChange, type = 'text', multiline }: FieldProps) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
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
            className="h-8 text-sm"
          />
        )
      ) : (
        <p className="text-sm font-medium">{value || '—'}</p>
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
    onError: () => toast.error('Cập nhật thất bại'),
  });

  function handleChange(field: keyof EditForm, val: string) {
    setForm((prev) => prev ? { ...prev, [field]: val } : prev);
  }

  function handleSave() {
    if (!form) return;
    // Only send fields accepted by backend schema (exclude 'notes' which is not a Contact field)
    const { notes: _notes, ...rest } = form;
    const payload = {
      ...rest,
      income: form.income ? Number(form.income) : undefined,
      creditLimit: form.creditLimit ? Number(form.creditLimit) : undefined,
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
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto sm:max-w-[700px]">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="flex items-center gap-3">
              {isLoading ? <Skeleton className="h-6 w-40" /> : (contact?.fullName ?? '—')}
              {contact && <ClickToCallButton phone={contact.phone} contactName={contact.fullName} />}
            </DialogTitle>
            <div className="flex gap-2">
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
            </div>
          </div>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-3 py-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        )}

        {contact && (
          <Tabs defaultValue="basic" className="mt-2">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="basic">{VI.contact.sections.basic}</TabsTrigger>
              <TabsTrigger value="work">{VI.contact.sections.work}</TabsTrigger>
              <TabsTrigger value="address">{VI.contact.sections.address}</TabsTrigger>
              <TabsTrigger value="finance">{VI.contact.sections.finance}</TabsTrigger>
              <TabsTrigger value="notes">{VI.contact.sections.notes}</TabsTrigger>
            </TabsList>

            {/* Basic info */}
            <TabsContent value="basic" className="mt-4">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <Field label={VI.contact.fullName} value={contact.fullName} edit={editMode} field="fullName" form={f} onChange={handleChange} />
                <Field label={VI.contact.phone} value={fmtPhone(contact.phone)} edit={editMode} field="phone" form={f} onChange={handleChange} />
                <Field label={VI.contact.phoneAlt} value={fmtPhone(contact.phoneAlt)} edit={editMode} field="phoneAlt" form={f} onChange={handleChange} />
                <Field label={VI.contact.email} value={contact.email} edit={editMode} field="email" form={f} onChange={handleChange} type="email" />
                <Field
                  label={VI.contact.gender}
                  value={contact.gender === 'male' ? 'Nam' : contact.gender === 'female' ? 'Nữ' : contact.gender}
                  edit={editMode}
                  field="gender"
                  form={f}
                  onChange={handleChange}
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
            </TabsContent>

            {/* Work */}
            <TabsContent value="work" className="mt-4">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <Field label={VI.contact.company} value={contact.company} edit={editMode} field="company" form={f} onChange={handleChange} />
                <Field label={VI.contact.jobTitle} value={contact.jobTitle} edit={editMode} field="jobTitle" form={f} onChange={handleChange} />
                <Field label={VI.contact.companyEmail} value={contact.companyEmail} edit={editMode} field="companyEmail" form={f} onChange={handleChange} type="email" />
                <Field label={VI.contact.occupation} value={contact.occupation} edit={editMode} field="occupation" form={f} onChange={handleChange} />
                <Field label={VI.contact.income} value={contact.income != null ? String(contact.income) : undefined} edit={editMode} field="income" form={f} onChange={handleChange} type="number" />
              </div>
            </TabsContent>

            {/* Address */}
            <TabsContent value="address" className="mt-4">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <Field label={VI.contact.province} value={contact.province} edit={editMode} field="province" form={f} onChange={handleChange} />
                <Field label={VI.contact.district} value={contact.district} edit={editMode} field="district" form={f} onChange={handleChange} />
                <div className="col-span-2 md:col-span-3">
                  <Field label={VI.contact.fullAddress} value={contact.fullAddress} edit={editMode} field="fullAddress" form={f} onChange={handleChange} multiline />
                </div>
              </div>
            </TabsContent>

            {/* Finance */}
            <TabsContent value="finance" className="mt-4">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <Field label={VI.contact.creditLimit} value={contact.creditLimit != null ? String(contact.creditLimit) : undefined} edit={editMode} field="creditLimit" form={f} onChange={handleChange} type="number" />
                <Field label={VI.contact.bankAccount} value={contact.bankAccount} edit={editMode} field="bankAccount" form={f} onChange={handleChange} />
                <Field label={VI.contact.bankName} value={contact.bankName} edit={editMode} field="bankName" form={f} onChange={handleChange} />
              </div>
            </TabsContent>

            {/* Notes */}
            <TabsContent value="notes" className="mt-4 space-y-4">
              <Field label={VI.contact.internalNotes} value={contact.internalNotes} edit={editMode} field="internalNotes" form={f} onChange={handleChange} multiline />
              <Field label={VI.lead.notes} value={(contact as unknown as Record<string, string>).notes} edit={editMode} field="notes" form={f} onChange={handleChange} multiline />
              <div className="space-y-1 pt-2 border-t text-xs text-muted-foreground">
                <p>{VI.contact.createdAt}: {format(new Date(contact.createdAt), 'dd/MM/yyyy HH:mm')}</p>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
