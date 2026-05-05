import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { VI } from '@/lib/vi-text';
import api from '@/services/api-client';

const DAYS = [
  { key: 'mon', label: 'T2' }, { key: 'tue', label: 'T3' },
  { key: 'wed', label: 'T4' }, { key: 'thu', label: 'T5' },
  { key: 'fri', label: 'T6' }, { key: 'sat', label: 'T7' },
  { key: 'sun', label: 'CN' },
] as const;

const WEEKDAYS = new Set(['mon', 'tue', 'wed', 'thu', 'fri']);
const ALL_DAYS = new Set(DAYS.map((d) => d.key));

interface FormState {
  name: string;
  category: string;
  queue: string;
  dialMode: string;
  workSchedule: string;
  workStartTime: string;
  workEndTime: string;
  workDays: Set<string>;
  startDate: string;
  endDate: string;
}

const EMPTY: FormState = {
  name: '', category: '', queue: '', dialMode: '',
  workSchedule: '', workStartTime: '08:00', workEndTime: '17:30',
  workDays: new Set(WEEKDAYS), startDate: '', endDate: '',
};

function SelectField({ label, value, onChange, options, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  options: [string, string][]; placeholder: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value || undefined} onValueChange={(v) => onChange(v ?? '')}>
        <SelectTrigger>
          {value
            ? <span>{options.find(([k]) => k === value)?.[1] ?? value}</span>
            : <span className="text-muted-foreground">{placeholder}</span>}
        </SelectTrigger>
        <SelectContent>
          {options.map(([val, lbl]) => <SelectItem key={val} value={val}>{lbl}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function CampaignCreateDialog() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>({ ...EMPTY, workDays: new Set(WEEKDAYS) });

  function set(field: keyof FormState, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleDay(day: string) {
    setForm((prev) => {
      const next = new Set(prev.workDays);
      next.has(day) ? next.delete(day) : next.add(day);
      return { ...prev, workDays: next };
    });
  }

  function handleScheduleChange(v: string) {
    set('workSchedule', v);
    if (v === 'all_day') {
      set('workStartTime', '00:00'); set('workEndTime', '23:59');
      set('workDays', new Set(ALL_DAYS));
    } else if (v === 'business_hours') {
      set('workStartTime', '08:00'); set('workEndTime', '17:30');
      set('workDays', new Set(WEEKDAYS));
    } else if (v === 'custom') {
      set('workStartTime', '08:00'); set('workEndTime', '17:30');
      set('workDays', new Set(WEEKDAYS));
    }
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string> = {
        name: form.name,
        type: form.category === 'collection' ? 'collection' : 'telesale',
      };
      if (form.category) payload.category = form.category;
      if (form.queue) payload.queue = form.queue;
      if (form.dialMode) payload.dialMode = form.dialMode;
      if (form.workSchedule) payload.workSchedule = form.workSchedule;
      if (form.workStartTime) payload.workStartTime = form.workStartTime;
      if (form.workEndTime) payload.workEndTime = form.workEndTime;
      if (form.startDate) payload.startDate = form.startDate;
      if (form.endDate) payload.endDate = form.endDate;
      const { data } = await api.post('/campaigns', payload);
      return data.data as { id: string };
    },
    onSuccess: (campaign) => {
      toast.success('Tạo chiến dịch thành công');
      setOpen(false);
      setForm({ ...EMPTY, workDays: new Set(WEEKDAYS) });
      navigate(`/campaigns/${campaign.id}`);
    },
    onError: () => toast.error('Tạo chiến dịch thất bại'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Vui lòng nhập tên chiến dịch'); return; }
    mutation.mutate();
  }

  const categories = Object.entries(VI.campaign.categories) as [string, string][];
  const queues = Object.entries(VI.campaign.queues) as [string, string][];
  const dialModes = Object.entries(VI.campaign.dialModes) as [string, string][];
  const schedules = Object.entries(VI.campaign.schedules) as [string, string][];

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1" /> {VI.actions.create}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Tạo chiến dịch mới</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>{VI.campaign.name} <span className="text-red-500">*</span></Label>
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Nhập tên chiến dịch" autoFocus />
            </div>

            <SelectField label={VI.campaign.category} value={form.category} onChange={(v) => set('category', v)} options={categories} placeholder="Chọn loại" />
            <SelectField label={VI.campaign.queue} value={form.queue} onChange={(v) => set('queue', v)} options={queues} placeholder="Chọn hàng đợi" />
            <SelectField label={VI.campaign.dialMode} value={form.dialMode} onChange={(v) => set('dialMode', v)} options={dialModes} placeholder="Chọn hình thức" />
            <SelectField label={VI.campaign.workSchedule} value={form.workSchedule} onChange={handleScheduleChange} options={schedules} placeholder="Chọn lịch" />

            {/* Time range + day picker for custom or show read-only for others */}
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
                <div className="space-y-1">
                  <Label className="text-xs">Ngày làm việc</Label>
                  <div className="flex gap-1">
                    {DAYS.map(({ key, label }) => (
                      <button key={key} type="button" disabled={form.workSchedule !== 'custom'}
                        onClick={() => toggleDay(key)}
                        className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                          form.workDays.has(key) ? 'bg-primary text-white border-primary' : 'bg-background border-border text-muted-foreground'
                        } ${form.workSchedule !== 'custom' ? 'opacity-60 cursor-not-allowed' : 'hover:bg-primary/80 hover:text-white'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{VI.campaign.startDate}</Label>
                <Input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{VI.campaign.endDate}</Label>
                <Input type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>{VI.actions.cancel}</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {VI.actions.create}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
