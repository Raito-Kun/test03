import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import api from '@/services/api-client';

interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; error: string }>;
}

interface ImportButtonProps {
  /** API endpoint for upload, e.g. "/leads/import" */
  endpoint: string;
  /** Template type for download, e.g. "leads" */
  templateType: string;
  /** Button label */
  label?: string;
  /** Query keys to invalidate on success */
  invalidateKeys?: string[];
}

export function ImportButton({ endpoint, templateType, label = 'Nhập CSV', invalidateKeys = [] }: ImportButtonProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post<{ success: boolean; data: ImportResult }>(endpoint, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data;
    },
    onSuccess: (result) => {
      const msg = `Đã nhập ${result.imported} bản ghi, bỏ qua ${result.skipped}`;
      if (result.errors.length > 0) {
        toast.warning(msg, { description: `${result.errors.length} lỗi. Dòng ${result.errors.slice(0, 3).map((e) => e.row).join(', ')}...` });
      } else {
        toast.success(msg);
      }
      invalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      if (fileRef.current) fileRef.current.value = '';
    },
    onError: (err: { response?: { data?: { error?: { message?: string } } }; message?: string }) => {
      toast.error(err?.response?.data?.error?.message || err?.message || 'Nhập thất bại');
      if (fileRef.current) fileRef.current.value = '';
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) mutation.mutate(file);
  };

  const handleDownloadTemplate = () => {
    const url = `${import.meta.env.VITE_API_URL || ''}/api/v1/templates/${templateType}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${templateType}-template.csv`;
    a.click();
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileRef.current?.click()}
        disabled={mutation.isPending}
      >
        <Upload className="mr-1.5 h-4 w-4" />
        {mutation.isPending ? 'Đang nhập...' : label}
      </Button>
      <Button variant="ghost" size="sm" onClick={handleDownloadTemplate} title="Tải template CSV">
        <Download className="mr-1.5 h-4 w-4" />
        Tải mẫu
      </Button>
    </div>
  );
}
