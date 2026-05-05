import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import api from '@/services/api-client';

interface DialplanRule {
  name: string;
  order: number;
}

interface Props {
  clusterId?: string;
  selected: string[];
  pgConfigured: boolean;
  onChange: (next: string[]) => void;
}

/**
 * Multi-select outbound dialplan rules for this cluster.
 * Loads the rule list from FusionPBX on demand (requires PG credentials).
 * Selected rules are checked by the preflight service one-by-one.
 */
export default function ClusterDialplanPicker({ clusterId, selected, pgConfigured, onChange }: Props) {
  const [rules, setRules] = useState<DialplanRule[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useMutation({
    mutationFn: async () => {
      if (!clusterId) throw new Error('Lưu cluster trước khi nạp danh sách rule');
      setLoadError(null);
      const { data } = await api.get(`/clusters/${clusterId}/dialplans`);
      return data.data as DialplanRule[];
    },
    onSuccess: (data) => {
      setRules(data);
      setLoaded(true);
    },
    onError: (err: Error) => setLoadError(err.message),
  });

  const toggle = (name: string) => {
    onChange(selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name]);
  };

  const missing = selected.filter((name) => !rules.some((r) => r.name === name));

  return (
    <div className="border-t border-dashed border-border pt-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-sm font-medium">Dialplan outbound có ghi âm</p>
          <p className="text-xs text-muted-foreground">
            Chọn các rule mà tenant này dùng để gọi ra (VD: OUT-VIETTEL, OUT-MOBI). Preflight sẽ check từng rule có đủ 6 action ghi âm.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!clusterId || !pgConfigured || load.isPending}
          onClick={() => load.mutate()}
          title={!pgConfigured ? 'Điền FusionPBX PG creds trước' : 'Nạp danh sách rule từ FusionPBX'}
        >
          {load.isPending
            ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
          {loaded ? 'Nạp lại' : 'Nạp danh sách'}
        </Button>
      </div>

      {loadError && (
        <div className="text-xs text-destructive bg-red-50 border border-red-200 rounded px-2 py-1.5 mb-2">
          {loadError}
        </div>
      )}

      {!loaded && selected.length > 0 && (
        <div className="text-xs text-muted-foreground mb-2">
          Đang chọn {selected.length} rule (chưa nạp danh sách):{' '}
          {selected.map((n) => <span key={n} className="inline-block bg-muted rounded px-1.5 py-0.5 mr-1 font-mono">{n}</span>)}
        </div>
      )}

      {loaded && (
        <div className="border border-dashed border-border rounded-sm divide-y divide-dashed max-h-64 overflow-y-auto">
          {rules.length === 0
            ? <div className="px-3 py-2 text-sm text-muted-foreground">Domain này không có dialplan rule nào đang enable.</div>
            : rules.map((r) => (
              <label key={r.name} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer">
                <Checkbox checked={selected.includes(r.name)} onCheckedChange={() => toggle(r.name)} />
                <span className="flex-1 font-mono text-sm">{r.name}</span>
                <span className="text-xs text-muted-foreground font-mono">order {r.order}</span>
              </label>
            ))}
        </div>
      )}

      {loaded && missing.length > 0 && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mt-2">
          Rule đã lưu nhưng không còn trong FusionPBX: {missing.join(', ')}. Bỏ tick để xoá.
        </div>
      )}

      {loaded && selected.length > 0 && (
        <div className="mt-2">
          <Label className="text-xs text-muted-foreground">Đã chọn {selected.length}/{rules.length}</Label>
        </div>
      )}
    </div>
  );
}
