import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Merge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import api from '@/services/api-client';

interface DuplicateGroup {
  phone: string;
  count: number;
  contacts: { id: string; fullName: string; phone: string; email: string | null; createdAt: string }[];
}

export function ContactMergeButton() {
  const [open, setOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<DuplicateGroup | null>(null);
  const [keepId, setKeepId] = useState<string>('');
  const queryClient = useQueryClient();

  const { data: groups, isLoading } = useQuery({
    queryKey: ['contact-duplicates'],
    queryFn: async () => {
      const { data: resp } = await api.get('/contact-merge/duplicates');
      return resp.data as DuplicateGroup[];
    },
    enabled: open,
  });

  const mergeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedGroup || !keepId) return;
      const mergeIds = selectedGroup.contacts.filter((c) => c.id !== keepId).map((c) => c.id);
      const { data: resp } = await api.post('/contact-merge/merge', { keepId, mergeIds });
      return resp.data;
    },
    onSuccess: (result) => {
      toast.success(`Đã gộp ${result.mergedCount} liên hệ trùng. Chuyển ${result.movedLeads} lead, ${result.movedCallLogs} cuộc gọi.`);
      setSelectedGroup(null);
      setKeepId('');
      queryClient.invalidateQueries({ queryKey: ['contact-duplicates'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
    onError: (err: Error) => toast.error(`Lỗi gộp: ${err.message}`),
  });

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Merge className="h-4 w-4 mr-1" />
        Gộp trùng
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setSelectedGroup(null); setKeepId(''); } }}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gộp liên hệ trùng lặp</DialogTitle>
          </DialogHeader>

          {!selectedGroup ? (
            /* Duplicate groups list */
            <div className="space-y-2">
              {isLoading && <p className="text-muted-foreground text-sm">Đang tìm...</p>}
              {groups && groups.length === 0 && <p className="text-muted-foreground text-sm">Không có liên hệ trùng lặp</p>}
              {groups?.map((g) => (
                <div
                  key={g.phone}
                  className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                  onClick={() => { setSelectedGroup(g); setKeepId(g.contacts[0].id); }}
                >
                  <div>
                    <span className="font-medium">{g.phone}</span>
                    <span className="text-muted-foreground text-sm ml-2">
                      {g.contacts.map((c) => c.fullName).join(', ')}
                    </span>
                  </div>
                  <Badge variant="secondary">{g.count} trùng</Badge>
                </div>
              ))}
            </div>
          ) : (
            /* Merge detail: pick which to keep */
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Chọn liên hệ giữ lại (các liên hệ còn lại sẽ được gộp vào):</p>
              {selectedGroup.contacts.map((c) => (
                <div
                  key={c.id}
                  className={`p-3 border rounded-lg cursor-pointer ${keepId === c.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                  onClick={() => setKeepId(c.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{c.fullName}</p>
                      <p className="text-sm text-muted-foreground">{c.phone} {c.email ? `· ${c.email}` : ''}</p>
                      <p className="text-xs text-muted-foreground">Tạo: {new Date(c.createdAt).toLocaleDateString('vi-VN')}</p>
                    </div>
                    {keepId === c.id && <Badge>Giữ lại</Badge>}
                  </div>
                </div>
              ))}

              <DialogFooter>
                <Button variant="ghost" onClick={() => setSelectedGroup(null)}>Quay lại</Button>
                <Button onClick={() => mergeMutation.mutate()} disabled={!keepId || mergeMutation.isPending}>
                  {mergeMutation.isPending ? 'Đang gộp...' : `Gộp ${selectedGroup.contacts.length - 1} liên hệ`}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
