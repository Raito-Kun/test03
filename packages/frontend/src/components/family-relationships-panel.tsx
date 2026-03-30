import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/services/api-client';

interface Guarantor {
  id: string;
  fullName: string;
  relationship: string;
  phone: string;
  address: string;
}

interface FamilyRelationshipsPanelProps {
  debtCaseId: string;
  contactId: string;
}

const RELATIONSHIP_OPTIONS = [
  { value: 'cha', label: 'Cha' },
  { value: 'me', label: 'Mẹ' },
  { value: 'vo', label: 'Vợ' },
  { value: 'chong', label: 'Chồng' },
  { value: 'anh-chi-em', label: 'Anh/Chị/Em' },
  { value: 'khac', label: 'Khác' },
];

const EMPTY_FORM = { fullName: '', relationship: '', phone: '', address: '' };

export function FamilyRelationshipsPanel({ debtCaseId, contactId }: FamilyRelationshipsPanelProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const queryClient = useQueryClient();

  const { data: guarantors = [], isLoading } = useQuery<Guarantor[]>({
    queryKey: ['guarantors', debtCaseId],
    queryFn: async () => {
      const { data } = await api.get(`/guarantors?debtCaseId=${debtCaseId}`);
      return data.data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      await api.post('/guarantors', { ...payload, debtCaseId, contactId });
    },
    onSuccess: () => {
      toast.success('Đã thêm người bảo lãnh');
      setForm(EMPTY_FORM);
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['guarantors', debtCaseId] });
    },
    onError: (err: Error) => toast.error(`Lỗi: ${err.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/guarantors/${id}`);
    },
    onSuccess: () => {
      toast.success('Đã xóa người bảo lãnh');
      queryClient.invalidateQueries({ queryKey: ['guarantors', debtCaseId] });
    },
    onError: (err: Error) => toast.error(`Lỗi: ${err.message}`),
  });

  function handleSubmit() {
    if (!form.fullName.trim() || !form.relationship || !form.phone.trim()) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }
    createMutation.mutate(form);
  }

  const relationshipLabel = (val: string) =>
    RELATIONSHIP_OPTIONS.find((r) => r.value === val)?.label ?? val;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Người bảo lãnh / Thân nhân</CardTitle>
          {!showForm && (
            <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
              <UserPlus className="h-4 w-4 mr-1" />
              Thêm người bảo lãnh
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Add form */}
        {showForm && (
          <div className="rounded border p-3 space-y-2 bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground">Thông tin người bảo lãnh</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <Input
                  placeholder="Họ và tên *"
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                />
              </div>
              <Select
                value={form.relationship}
                onValueChange={(v) => setForm((f) => ({ ...f, relationship: v ?? '' }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Quan hệ *" />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONSHIP_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Số điện thoại *"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
              <div className="col-span-2">
                <Input
                  placeholder="Địa chỉ"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}>
                Hủy
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={createMutation.isPending}>
                <Plus className="h-4 w-4 mr-1" />
                Thêm
              </Button>
            </div>
          </div>
        )}

        {/* Guarantor list */}
        {isLoading && <p className="text-sm text-muted-foreground">Đang tải...</p>}

        {!isLoading && guarantors.length === 0 && !showForm && (
          <p className="text-sm text-muted-foreground">Chưa có người bảo lãnh.</p>
        )}

        {guarantors.map((g) => (
          <div key={g.id} className="flex items-start justify-between rounded border p-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">{g.fullName}</p>
              <p className="text-xs text-muted-foreground">
                {relationshipLabel(g.relationship)} &bull; {g.phone}
              </p>
              {g.address && (
                <p className="text-xs text-muted-foreground">{g.address}</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => deleteMutation.mutate(g.id)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
