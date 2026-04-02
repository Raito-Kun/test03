/** CSV export button — includes UTF-8 BOM for Excel Vietnamese support */
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export interface CsvHeader { key: string; label: string }

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function exportCsv(
  rows: Record<string, unknown>[],
  headers: CsvHeader[],
  fileName: string,
) {
  if (!rows.length) { toast.error('Không có dữ liệu để xuất'); return; }
  const BOM = '\uFEFF';
  const headerLine = headers.map((h) => `"${h.label}"`).join(',');
  const dataLines = rows.map((row) =>
    headers.map((h) => {
      const val = row[h.key] ?? '';
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(','),
  );
  const csv = BOM + [headerLine, ...dataLines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${fileName}_${today()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast.success('Xuất báo cáo thành công');
}

interface Props {
  rows: Record<string, unknown>[];
  headers: CsvHeader[];
  fileName: string;
  disabled?: boolean;
}

export function ReportExportButton({ rows, headers, fileName, disabled }: Props) {
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled || !rows.length}
      onClick={() => exportCsv(rows, headers, fileName)}
      className="gap-1.5"
    >
      <Download className="h-4 w-4" />
      Xuất báo cáo
    </Button>
  );
}
