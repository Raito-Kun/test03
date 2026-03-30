import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getAccessToken } from '@/services/api-client';

interface ExportButtonProps {
  /** Entity name matching backend: contacts, leads, call-logs, tickets, campaigns, debt-cases */
  entity: string;
  /** Current filter state from the list page — passed as query params */
  filters?: Record<string, string | number | undefined>;
}

/** Reusable Excel export button — drop into any list page's action area */
export function ExportButton({ entity, filters }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters) {
        for (const [key, val] of Object.entries(filters)) {
          if (val !== undefined && val !== '') params.set(key, String(val));
        }
      }
      const url = `/api/v1/export/${entity}${params.toString() ? `?${params}` : ''}`;
      const token = getAccessToken();

      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: 'Export failed' } }));
        throw new Error(err.error?.message || `HTTP ${res.status}`);
      }

      // Download the blob
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${entity}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success('Xuất Excel thành công');
    } catch (err) {
      toast.error(`Lỗi xuất Excel: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={loading}>
      <Download className="h-4 w-4 mr-1" />
      {loading ? 'Đang xuất...' : 'Xuất Excel'}
    </Button>
  );
}
