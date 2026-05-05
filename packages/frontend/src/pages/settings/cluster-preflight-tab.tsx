import { useMutation } from '@tanstack/react-query';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, MinusCircle, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import api from '@/services/api-client';

export interface PreflightCheck {
  key: string;
  label: string;
  required: boolean;
  status: 'pass' | 'fail' | 'skipped' | 'warn';
  message: string;
  hint?: string;
  durationMs: number;
}

export interface PreflightResult {
  clusterId: string;
  checks: PreflightCheck[];
  allRequiredPass: boolean;
  ranAt: string;
}

const STATUS_ICON = {
  pass: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  fail: <XCircle className="h-4 w-4 text-red-600" />,
  warn: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  skipped: <MinusCircle className="h-4 w-4 text-muted-foreground" />,
};

const STATUS_LABEL: Record<PreflightCheck['status'], string> = {
  pass: 'Đạt',
  fail: 'Không đạt',
  warn: 'Cảnh báo',
  skipped: 'Bỏ qua',
};

export default function ClusterPreflightTab({ clusterId, disabled }: { clusterId?: string; disabled?: boolean }) {
  const preflight = useMutation<PreflightResult, Error>({
    mutationFn: async () => {
      if (!clusterId) throw new Error('Chưa có cluster id');
      const { data } = await api.post(`/clusters/${clusterId}/preflight`);
      return data.data as PreflightResult;
    },
  });

  if (!clusterId) {
    return (
      <div className="text-sm text-muted-foreground bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
        Lưu cluster trước khi chạy kiểm tra tiền khởi động.
      </div>
    );
  }

  const result = preflight.data;
  const summary = result
    ? result.allRequiredPass
      ? <Badge className="bg-green-600 hover:bg-green-600">Sẵn sàng kích hoạt</Badge>
      : <Badge variant="destructive">{result.checks.filter((c) => c.required && c.status === 'fail').length} lỗi bắt buộc</Badge>
    : null;

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
        Preflight chạy 7 kiểm tra read-only: ESL, SSH, domain trên PBX, dialplan ghi âm, whitelist webhook, proxy ghi âm, số extension. Không chỉnh sửa gì trên FusionPBX. Fix theo hint rồi chạy lại.
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button onClick={() => preflight.mutate()} disabled={preflight.isPending || disabled} size="sm">
            {preflight.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <PlayCircle className="h-3.5 w-3.5 mr-1.5" />}
            Chạy kiểm tra
          </Button>
          {summary}
        </div>
        {result && (
          <span className="text-xs text-muted-foreground">
            Chạy lúc {new Date(result.ranAt).toLocaleTimeString('vi-VN')}
          </span>
        )}
      </div>

      {preflight.error && (
        <div className="text-sm text-destructive bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {preflight.error.message}
        </div>
      )}

      {result && (
        <div className="border border-dashed border-border rounded-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-dashed border-border">
              <tr>
                <th className="text-left px-3 py-2 font-medium w-10"></th>
                <th className="text-left px-3 py-2 font-medium">Kiểm tra</th>
                <th className="text-left px-3 py-2 font-medium w-24">Trạng thái</th>
                <th className="text-left px-3 py-2 font-medium">Kết quả</th>
                <th className="text-right px-3 py-2 font-medium w-16">Thời gian</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {result.checks.map((c) => (
                <tr key={c.key} className={c.status === 'fail' && c.required ? 'bg-red-50/50' : ''}>
                  <td className="px-3 py-2">{STATUS_ICON[c.status]}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{c.label}</div>
                    {!c.required && <div className="text-xs text-muted-foreground">Không bắt buộc</div>}
                  </td>
                  <td className="px-3 py-2">{STATUS_LABEL[c.status]}</td>
                  <td className="px-3 py-2">
                    <div>{c.message}</div>
                    {c.hint && c.status !== 'pass' && (
                      <div className="text-xs text-muted-foreground mt-0.5">→ {c.hint}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-muted-foreground">{c.durationMs}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
