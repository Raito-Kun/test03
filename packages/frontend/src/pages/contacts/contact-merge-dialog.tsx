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
            <DialogTitle className="text-primary font-bold">Gộp liên hệ trùng lặp</DialogTitle>
          </DialogHeader>

          {!selectedGroup ? (
            /* Duplicate groups list */
            <div className="space-y-2">
              {isLoading && <p className="text-muted-foreground text-sm">Đang tìm...</p>}
              {groups && groups.length === 0 && (
                <p className="text-muted-foreground text-sm text-center py-6">Không có liên hệ trùng lặp</p>
              )}
              {groups?.map((g) => (
                <div
                  key={g.phone}
                  className="flex items-center justify-between p-3 border border-dashed border-border rounded-xl cursor-pointer hover:bg-accent/30 transition-colors"
                  onClick={() => { setSelectedGroup(g); setKeepId(g.contacts[0].id); }}
                >
                  <div>
                    <span className="font-bold text-sm font-mono">{g.phone}</span>
                    <span className="text-muted-foreground text-xs ml-2">
                      {g.contacts.map((c) => c.fullName).join(', ')}
                    </span>
                  </div>
                  <Badge className="bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold">
                    {g.count} trùng
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            /* Merge detail: pick which to keep */
            <div className="space-y-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest font-mono">
                Chọn liên hệ giữ lại — các liên hệ còn lại sẽ được gộp vào
              </p>
              {selectedGroup.contacts.map((c) => (
                <div
                  key={c.id}
                  className={`p-4 border border-dashed rounded-xl cursor-pointer transition-colors ${
                    keepId === c.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/30'
                  }`}
                  onClick={() => setKeepId(c.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm">{c.fullName}</p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">
                        {c.phone}{c.email ? ` · ${c.email}` : ''}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Tạo: {new Date(c.createdAt).toLocaleDateString('vi-VN')}
                      </p>
                    </div>
                    {keepId === c.id && (
                      <Badge className="bg-primary text-primary-foreground text-xs font-bold">Giữ lại</Badge>
                    )}
                  </div>
                </div>
              ))}

              <DialogFooter className="pt-2 border-t border-dashed border-border">
                <Button variant="outline" className="border-dashed" onClick={() => setSelectedGroup(null)}>
                  Quay lại
                </Button>
                <Button
                  onClick={() => mergeMutation.mutate()}
                  disabled={!keepId || mergeMutation.isPending}
                  className="bg-primary hover:bg-primary/90"
                >
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
