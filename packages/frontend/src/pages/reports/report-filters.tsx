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

  return (
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
        <Label className="text-xs">Team</Label>
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
  );
}
