/** Shared filter bar: date range, user/team dropdowns, search button */
import { Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import api from '@/services/api-client';

export interface FilterState {
  dateFrom: string;
  dateTo: string;
  userId: string;
  teamId: string;
}

interface Props {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  onSearch: () => void;
  loading?: boolean;
  extraSlot?: React.ReactNode;
}

interface UserItem { id: string; fullName: string; role: string; teamId?: string }
interface TeamItem { id: string; name: string; type?: string }

// ISO date helpers — preserve local timezone (avoid `toISOString` which converts to UTC)
function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface PresetRange { dateFrom: string; dateTo: string }

function presetToday(): PresetRange {
  const d = toIso(new Date());
  return { dateFrom: d, dateTo: d };
}

function presetYesterday(): PresetRange {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const iso = toIso(d);
  return { dateFrom: iso, dateTo: iso };
}

function presetLast7Days(): PresetRange {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 6); // includes today → 7-day window
  return { dateFrom: toIso(from), dateTo: toIso(to) };
}

function presetLastMonth(): PresetRange {
  const now = new Date();
  // First day of previous month, last day of previous month
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to = new Date(now.getFullYear(), now.getMonth(), 0);
  return { dateFrom: toIso(from), dateTo: toIso(to) };
}

const PRESETS: Array<{ label: string; build: () => PresetRange }> = [
  { label: 'Hôm nay', build: presetToday },
  { label: 'Hôm qua', build: presetYesterday },
  { label: '7 ngày qua', build: presetLast7Days },
  { label: 'Tháng trước', build: presetLastMonth },
];

export function ReportFilters({ filters, onChange, onSearch, loading, extraSlot }: Props) {
  const { data: users } = useQuery({
    queryKey: ['users-active'],
    queryFn: () => api.get<{ data: UserItem[] }>('/users', { params: { status: 'active' } }).then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const { data: teams } = useQuery({
    queryKey: ['teams-list'],
    queryFn: () => api.get<{ data: TeamItem[] }>('/teams').then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  function set(key: keyof FilterState, val: string) {
    onChange({ ...filters, [key]: val });
  }

  function applyPreset(range: PresetRange) {
    // Update dates and immediately fire search — user expects one-click effect.
    onChange({ ...filters, ...range });
    // Defer to next tick so onChange's state update flushes before search reads it.
    setTimeout(onSearch, 0);
  }

  // Match preset by current date pair, used to highlight active button
  function isActivePreset(range: PresetRange): boolean {
    return filters.dateFrom === range.dateFrom && filters.dateTo === range.dateTo;
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Preset chips row */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map(({ label, build }) => {
          const range = build();
          const active = isActivePreset(range);
          return (
            <button
              key={label}
              type="button"
              onClick={() => applyPreset(range)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border border-dashed ${
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:bg-accent hover:text-foreground'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label className="text-xs">Từ ngày</Label>
        <Input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => set('dateFrom', e.target.value)}
          className="w-40"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Đến ngày</Label>
        <Input
          type="date"
          value={filters.dateTo}
          onChange={(e) => set('dateTo', e.target.value)}
          className="w-40"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Nhân viên</Label>
        <Select value={filters.userId} onValueChange={(v) => set('userId', v ?? '')}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Tất cả" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Tất cả</SelectItem>
            {users?.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Nhóm</Label>
        <Select value={filters.teamId} onValueChange={(v) => set('teamId', v ?? '')}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tất cả" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Tất cả</SelectItem>
            {teams?.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {extraSlot}

      <Button onClick={onSearch} disabled={loading} className="gap-1.5">
        <Search className="h-4 w-4" />
        Tìm kiếm
      </Button>
      </div>
    </div>
  );
}
