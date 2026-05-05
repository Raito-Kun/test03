import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import api from '@/services/api-client';

interface Props {
  open: boolean;
  clusterId: string;
  onClose: () => void;
  onImported: () => void;
}

interface CsvRow { name: string; email: string; role: string; extension?: string }

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  // Expect header: name,email,role,extension
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const [name, email, role, extension] = lines[i].split(',').map((s) => s.trim());
    if (name && email && role) rows.push({ name, email, role, extension: extension || undefined });
  }
  return rows;
}

const CSV_TEMPLATE = 'name,email,role,extension\nNguyễn Văn A,agent01@cluster.local,agent,101\nTrần Thị B,agent02@cluster.local,agent,102\n';

const fieldLabel = 'text-[12px] uppercase tracking-wider font-mono text-muted-foreground';

export function AccountImportDialog({ open, clusterId, onClose, onImported }: Props) {
  const [preview, setPreview] = useState<CsvRow[]>([]);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCsv(ev.target?.result as string);
      setPreview(rows);
      if (rows.length === 0) toast.error('File CSV không hợp lệ hoặc không có dữ liệu');
    };
    reader.readAsText(file, 'UTF-8');
  }

  const mutation = useMutation({
    mutationFn: () => api.post(`/clusters/${clusterId}/accounts/import-csv`, { rows: preview }),
    onSuccess: (res) => {
      const { created, skipped } = res.data.data ?? {};
      toast.success(`Đã tạo ${created?.length ?? 0} tài khoản${skipped?.length ? `, bỏ qua ${skipped.length} (email đã tồn tại)` : ''}`);
      setPreview([]);
      setFileName('');
      if (fileRef.current) fileRef.current.value = '';
      onImported();
      onClose();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error?.message || 'Nhập dữ liệu thất bại'),
  });

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_accounts.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleClose() {
    setPreview([]);
    setFileName('');
    if (fileRef.current) fileRef.current.value = '';
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-lg rounded-xl">
        <DialogHeader>
          <DialogTitle>Nhập tài khoản từ CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Format hint */}
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 space-y-1">
            <p className={`${fieldLabel} mb-1`}>Định dạng CSV</p>
            <code className="block font-mono text-xs text-foreground">name,email,role,extension</code>
            <p className="text-xs text-muted-foreground">
              Mật khẩu mặc định: <strong className="font-mono">Pls@1234!</strong> — yêu cầu đổi khi đăng nhập lần đầu.
            </p>
          </div>

          {/* Dashed divider */}
          <div className="dashed-divider" />

          {/* File picker */}
          <div className="space-y-1.5">
            <p className={fieldLabel}>Chọn file</p>
            <div className="flex gap-2">
              <label className="flex-1 flex items-center justify-center border-2 border-dashed rounded-lg px-4 py-3 cursor-pointer hover:border-primary transition-colors text-sm text-muted-foreground hover:text-foreground">
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
                {fileName ? fileName : 'Chọn file CSV...'}
              </label>
              <Button type="button" variant="outline" size="sm" onClick={downloadTemplate} title="Tải template">
                <Download className="h-4 w-4 mr-1.5" />
                Template
              </Button>
            </div>
          </div>

          {/* Preview table */}
          {preview.length > 0 && (
            <>
              <div className="dashed-divider" />
              <div className="border border-dashed rounded-lg overflow-hidden">
                <div className="bg-muted/40 px-3 py-1.5">
                  <span className={fieldLabel}>Xem trước — {preview.length} dòng</span>
                </div>
                <div className="max-h-40 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="border-b bg-muted/20">
                      <tr>
                        <th className="text-left px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Họ tên</th>
                        <th className="text-left px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Email</th>
                        <th className="text-left px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Vai trò</th>
                        <th className="text-left px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Máy lẻ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {preview.map((row, i) => (
                        <tr key={i} className="hover:bg-muted/30">
                          <td className="px-3 py-1">{row.name}</td>
                          <td className="px-3 py-1 text-muted-foreground">{row.email}</td>
                          <td className="px-3 py-1">{row.role}</td>
                          <td className="px-3 py-1 font-mono">{row.extension || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>Hủy</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={preview.length === 0 || mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Nhập {preview.length > 0 ? `${preview.length} tài khoản` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
