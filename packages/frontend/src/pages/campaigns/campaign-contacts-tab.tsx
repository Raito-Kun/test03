import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { CampaignActionsMenu } from './campaign-actions-menu';
import api from '@/services/api-client';

interface Lead {
  id: string;
  contact?: { id: string; fullName: string; phone: string; dateOfBirth?: string | null };
  fullName?: string;
  phone?: string;
}

interface Props {
  campaignId: string;
}

export function CampaignContactsTab({ campaignId }: Props) {
  const [search, setSearch] = useState('');
  const [phoneFilter, setPhoneFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['campaign-leads', campaignId],
    queryFn: () =>
      api.get<{ data: { items: Lead[] } }>(`/leads?campaignId=${campaignId}&limit=50`).then((r) => r.data.data),
  });

  const leads = data?.items ?? [];
  const filtered = leads.filter((l) => {
    const name = l.contact?.fullName ?? l.fullName ?? '';
    const phone = l.contact?.phone ?? l.phone ?? '';
    const matchName = !search || name.toLowerCase().includes(search.toLowerCase());
    const matchPhone = !phoneFilter || phone.includes(phoneFilter);
    return matchName && matchPhone;
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Tìm theo tên" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" />
        </div>
        <Input placeholder="Nhập số điện thoại" value={phoneFilter} onChange={(e) => setPhoneFilter(e.target.value)} className="w-44 h-9" />
        <CampaignActionsMenu />
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="w-10 px-3 py-2"><input type="checkbox" className="rounded" /></th>
                <th className="text-left px-3 py-2 font-medium">Khách hàng</th>
                <th className="text-left px-3 py-2 font-medium">Số điện thoại</th>
                <th className="text-left px-3 py-2 font-medium">Ngày sinh</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">Không có dữ liệu</td></tr>
              ) : (
                filtered.map((lead) => {
                  const name = lead.contact?.fullName ?? lead.fullName ?? '—';
                  const phone = lead.contact?.phone ?? lead.phone ?? '—';
                  const dob = lead.contact?.dateOfBirth;
                  return (
                    <tr key={lead.id} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2"><input type="checkbox" className="rounded" /></td>
                      <td className="px-3 py-2 font-medium text-blue-600">{name}</td>
                      <td className="px-3 py-2">{phone}</td>
                      <td className="px-3 py-2">{dob ? format(new Date(dob), 'dd/MM/yyyy') : '—'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <div className="flex items-center justify-between px-3 py-2 bg-muted/30 text-xs text-muted-foreground border-t">
            <span>Hiển thị {filtered.length} trong {leads.length} bản ghi</span>
            <span>Trang 1/1</span>
          </div>
        </div>
      )}
    </div>
  );
}
