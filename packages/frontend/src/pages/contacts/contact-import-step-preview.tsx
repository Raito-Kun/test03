import { useRef } from 'react';
import { Upload, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ContactImportRow } from './contact-import-wizard-types';

interface Props {
  rows: ContactImportRow[];
  totalRaw: number;
  errors: Array<{ row: number; error: string }>;
  uploading: boolean;
  onUpload: (file: File) => void;
}

const PREVIEW_LIMIT = 50;

export function ImportStepPreview({ rows, totalRaw, errors, uploading, onUpload }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = rows.slice(0, PREVIEW_LIMIT);

  const handleDownloadTemplate = () => {
    const url = `${import.meta.env.VITE_API_URL || ''}/api/v1/templates/contacts`;
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contacts-template.csv';
    a.click();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); }}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="mr-1.5 h-4 w-4" />
          {uploading ? 'Đang phân tích...' : rows.length > 0 ? 'Chọn file khác' : 'Chọn file CSV/Excel'}
        </Button>
        <Button variant="ghost" size="sm" onClick={handleDownloadTemplate} title="Tải mẫu CSV">
          <Download className="mr-1.5 h-4 w-4" />
          Tải mẫu
        </Button>
      </div>

      {rows.length > 0 && (
        <div className="text-sm text-muted-foreground">
          Tổng: <span className="font-medium text-foreground">{totalRaw}</span> dòng,{' '}
          <span className="font-medium text-emerald-700">{rows.length}</span> hợp lệ
          {errors.length > 0 && (
            <>, <span className="font-medium text-rose-700">{errors.length}</span> lỗi</>
          )}
        </div>
      )}

      {errors.length > 0 && (
        <details className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs">
          <summary className="cursor-pointer font-medium text-rose-700">
            {errors.length} dòng bị lỗi (nhấp để xem)
          </summary>
          <ul className="mt-2 space-y-1">
            {errors.slice(0, 20).map((e) => (
              <li key={e.row}>Dòng {e.row}: {e.error}</li>
            ))}
            {errors.length > 20 && <li className="italic">...và {errors.length - 20} lỗi khác</li>}
          </ul>
        </details>
      )}

      {preview.length > 0 && (
        <div className="max-h-[50vh] overflow-auto rounded-md border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">#</th>
                <th className="px-2 py-1.5 text-left font-medium">Họ tên</th>
                <th className="px-2 py-1.5 text-left font-medium">SĐT</th>
                <th className="px-2 py-1.5 text-left font-medium">Email</th>
                <th className="px-2 py-1.5 text-left font-medium">Công ty</th>
                <th className="px-2 py-1.5 text-left font-medium">Địa chỉ</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((r) => (
                <tr key={r.rowNumber} className="border-t">
                  <td className="px-2 py-1 text-muted-foreground">{r.rowNumber}</td>
                  <td className="px-2 py-1">{r.fullName}</td>
                  <td className="px-2 py-1">{r.phone}</td>
                  <td className="px-2 py-1">{r.email || '—'}</td>
                  <td className="px-2 py-1">{r.company || '—'}</td>
                  <td className="px-2 py-1">{r.address || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > PREVIEW_LIMIT && (
            <div className="border-t bg-muted/50 px-2 py-1.5 text-center text-xs text-muted-foreground">
              Đang hiển thị {PREVIEW_LIMIT} / {rows.length} dòng hợp lệ
            </div>
          )}
        </div>
      )}

      {rows.length === 0 && !uploading && (
        <div className="flex min-h-[120px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
          Chọn file CSV hoặc Excel để xem trước dữ liệu
        </div>
      )}
    </div>
  );
}
