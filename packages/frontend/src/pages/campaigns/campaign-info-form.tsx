import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { VI } from '@/lib/vi-text';
import api from '@/services/api-client';

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: string;
  category?: string | null;
  queue?: string | null;
  dialMode?: string | null;
  callbackUrl?: string | null;
  workSchedule?: string | null;
  workStartTime?: string | null;
  workEndTime?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  script?: string | null;
}

interface Props {
  campaign: Campaign;
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: Record<string, string>;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label} <span className="text-red-500">*</span></Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="">-- Chọn --</option>
        {Object.entries(options).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
    </div>
  );
}

export function CampaignInfoForm({ campaign }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: campaign.name ?? '',
    category: campaign.category ?? '',
    queue: campaign.queue ?? '',
    dialMode: campaign.dialMode ?? '',
    callbackUrl: campaign.callbackUrl ?? '',
    workSchedule: campaign.workSchedule ?? '',
    workStartTime: campaign.workStartTime ?? '',
    workEndTime: campaign.workEndTime ?? '',
    startDate: campaign.startDate?.substring(0, 10) ?? '',
    endDate: campaign.endDate?.substring(0, 10) ?? '',
    script: campaign.script ?? '',
  });

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.patch(`/campaigns/${campaign.id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaign.id] });
      toast.success('Đã cập nhật chiến dịch');
    },
    onError: () => toast.error('Cập nhật thất bại'),
  });

  function handleSave() {
    mutation.mutate({
      ...form,
      category: form.category || undefined,
      queue: form.queue || undefined,
      dialMode: form.dialMode || undefined,
      workSchedule: form.workSchedule || undefined,
    });
  }

  function set(field: string, val: string) {
    setForm((prev) => ({ ...prev, [field]: val }));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{VI.campaign.detailTitle}</h2>
        <Button size="sm" onClick={handleSave} disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
          {VI.actions.save}
        </Button>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">{VI.campaign.name} <span className="text-red-500">*</span></Label>
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
        </div>

        <SelectField label={VI.campaign.category} value={form.category} onChange={(v) => set('category', v)}
          options={VI.campaign.categories} />

        <SelectField label={VI.campaign.queue} value={form.queue} onChange={(v) => set('queue', v)}
          options={VI.campaign.queues} />

        <SelectField label={VI.campaign.dialMode} value={form.dialMode} onChange={(v) => set('dialMode', v)}
          options={VI.campaign.dialModes} />

        <div className="space-y-1.5">
          <Label className="text-sm font-medium">{VI.campaign.callbackUrl}</Label>
          <Input value={form.callbackUrl} onChange={(e) => set('callbackUrl', e.target.value)} placeholder="Nhập callback URL" />
        </div>

        <SelectField label={VI.campaign.workSchedule} value={form.workSchedule} onChange={(v) => set('workSchedule', v)}
          options={VI.campaign.schedules} />

        {form.workSchedule && (
          <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Giờ bắt đầu</Label>
                <Input type="time" value={form.workStartTime} onChange={(e) => set('workStartTime', e.target.value)} disabled={form.workSchedule !== 'custom'} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Giờ kết thúc</Label>
                <Input type="time" value={form.workEndTime} onChange={(e) => set('workEndTime', e.target.value)} disabled={form.workSchedule !== 'custom'} className="h-8 text-sm" />
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">{VI.campaign.startDate}</Label>
            <Input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">{VI.campaign.endDate}</Label>
            <Input type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium">{VI.campaign.script}</Label>
          <Textarea value={form.script} onChange={(e) => set('script', e.target.value)} rows={4} placeholder="Nhập kịch bản cuộc gọi..." />
        </div>
      </div>
    </div>
  );
}
