import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquarePlus, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import api from '@/services/api-client';

interface TimestampNote {
  time: number;
  note: string;
  severity: 'info' | 'warning' | 'error';
}

interface QaTimestampAnnotationsProps {
  callLogId: string;
  /** Current playback time in seconds — pass from audio player ref */
  currentTime: number;
  /** Callback to seek audio to a specific time */
  onSeek?: (time: number) => void;
}

const SEVERITY_CONFIG = {
  info: { icon: Info, color: 'bg-blue-500', label: 'Thông tin', badge: 'default' as const },
  warning: { icon: AlertTriangle, color: 'bg-yellow-500', label: 'Cảnh báo', badge: 'secondary' as const },
  error: { icon: AlertCircle, color: 'bg-red-500', label: 'Lỗi nghiêm trọng', badge: 'destructive' as const },
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * QA timestamp annotations — render below audio player.
 * Shows timeline markers + add annotation at current playback time.
 */
export function QaTimestampAnnotations({ callLogId, currentTime, onSeek }: QaTimestampAnnotationsProps) {
  const [showForm, setShowForm] = useState(false);
  const [note, setNote] = useState('');
  const [severity, setSeverity] = useState<string>('info');
  const queryClient = useQueryClient();

  const { data: annotations } = useQuery({
    queryKey: ['qa-timestamps', callLogId],
    queryFn: async () => {
      const { data: resp } = await api.get(`/qa-timestamps/call/${callLogId}`);
      const all: TimestampNote[] = [];
      for (const ann of resp.data || []) {
        if (Array.isArray(ann.timestampNote)) {
          all.push(...ann.timestampNote);
        }
      }
      return all.sort((a, b) => a.time - b.time);
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/qa-timestamps/call/${callLogId}/quick`, {
        time: currentTime,
        note,
        severity,
      });
    },
    onSuccess: () => {
      toast.success('Đã thêm ghi chú');
      setNote('');
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['qa-timestamps', callLogId] });
    },
    onError: (err: Error) => toast.error(`Lỗi: ${err.message}`),
  });

  return (
    <div className="mt-3 space-y-2">
      {/* Timeline markers */}
      {annotations && annotations.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Ghi chú QA</p>
          {annotations.map((ann, i) => {
            const config = SEVERITY_CONFIG[ann.severity] || SEVERITY_CONFIG.info;
            const Icon = config.icon;
            return (
              <div
                key={i}
                className="flex items-start gap-2 p-2 rounded border cursor-pointer hover:bg-muted/50"
                onClick={() => onSeek?.(ann.time)}
              >
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${config.color}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-primary">{formatTime(ann.time)}</span>
                    <Badge variant={config.badge} className="text-xs">{config.label}</Badge>
                  </div>
                  <p className="text-sm mt-0.5">{ann.note}</p>
                </div>
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
            );
          })}
        </div>
      )}

      {/* Add annotation form */}
      {showForm ? (
        <div className="flex items-end gap-2 p-2 border rounded">
          <div className="flex-1 space-y-1">
            <p className="text-xs text-muted-foreground">Ghi chú tại {formatTime(currentTime)}</p>
            <Input
              placeholder="Nhập ghi chú..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && note.trim()) addMutation.mutate(); }}
              autoFocus
            />
          </div>
          <Select value={severity} onValueChange={(v) => setSeverity(v || 'info')}>
            <SelectTrigger className="w-32">
              <span>{SEVERITY_CONFIG[severity as keyof typeof SEVERITY_CONFIG]?.label || severity}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="info">Thông tin</SelectItem>
              <SelectItem value="warning">Cảnh báo</SelectItem>
              <SelectItem value="error">Lỗi</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => addMutation.mutate()} disabled={!note.trim() || addMutation.isPending}>
            Lưu
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Hủy</Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
          <MessageSquarePlus className="h-4 w-4 mr-1" />
          Ghi chú tại {formatTime(currentTime)}
        </Button>
      )}
    </div>
  );
}
