import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Plus, ThumbsUp, ThumbsDown, StickyNote } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/services/api-client';

interface QaAnnotation {
  id: string;
  timestampSeconds: number;
  category: 'good' | 'bad' | 'neutral';
  comment: string;
  createdByName?: string;
}

interface QaAnnotationInlineProps {
  callLogId: string;
  recordingDuration: number;
  onSeek?: (time: number) => void;
}

const CATEGORY_CONFIG = {
  good: { label: 'Tốt', color: 'bg-green-500', badgeClass: 'bg-green-100 text-green-800 border-green-200', icon: ThumbsUp },
  bad: { label: 'Cần cải thiện', color: 'bg-red-500', badgeClass: 'bg-red-100 text-red-800 border-red-200', icon: ThumbsDown },
  neutral: { label: 'Ghi chú', color: 'bg-blue-500', badgeClass: 'bg-blue-100 text-blue-800 border-blue-200', icon: StickyNote },
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function QaAnnotationInline({ callLogId, recordingDuration, onSeek }: QaAnnotationInlineProps) {
  const [showForm, setShowForm] = useState(false);
  const [timeInput, setTimeInput] = useState('0');
  const [category, setCategory] = useState<string>('neutral');
  const [comment, setComment] = useState('');
  const queryClient = useQueryClient();

  const { data: annotations = [], isLoading } = useQuery<QaAnnotation[]>({
    queryKey: ['qa-annotations-inline', callLogId],
    queryFn: async () => {
      const { data } = await api.get('/qa-timestamps', { params: { callLogId } });
      return (data.data ?? data) as QaAnnotation[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      await api.post('/qa-timestamps', {
        callLogId,
        timestampSeconds: Number(timeInput),
        category,
        comment,
      });
    },
    onSuccess: () => {
      toast.success('Đã thêm ghi chú');
      setComment('');
      setTimeInput('0');
      setCategory('neutral');
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['qa-annotations-inline', callLogId] });
    },
    onError: (err: Error) => toast.error(`Lỗi: ${err.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/qa-timestamps/${id}`);
    },
    onSuccess: () => {
      toast.success('Đã xóa ghi chú');
      queryClient.invalidateQueries({ queryKey: ['qa-annotations-inline', callLogId] });
    },
    onError: (err: Error) => toast.error(`Lỗi: ${err.message}`),
  });

  const sorted = [...annotations].sort((a, b) => a.timestampSeconds - b.timestampSeconds);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Ghi chú QA</p>
        <Button variant="outline" size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4 mr-1" />
          Thêm ghi chú
        </Button>
      </div>

      {/* Timeline bar */}
      {recordingDuration > 0 && sorted.length > 0 && (
        <div className="relative h-3 bg-muted rounded-full overflow-visible">
          {sorted.map((ann) => {
            const pct = Math.min(100, (ann.timestampSeconds / recordingDuration) * 100);
            const cfg = CATEGORY_CONFIG[ann.category] ?? CATEGORY_CONFIG.neutral;
            return (
              <button
                key={ann.id}
                title={`${formatTime(ann.timestampSeconds)}: ${ann.comment}`}
                className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow ${cfg.color} hover:scale-125 transition-transform cursor-pointer`}
                style={{ left: `${pct}%` }}
                onClick={() => onSeek?.(ann.timestampSeconds)}
              />
            );
          })}
        </div>
      )}

      {/* Annotation list */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Đang tải...</p>
      ) : sorted.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">Chưa có ghi chú nào</p>
      ) : (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {sorted.map((ann) => {
            const cfg = CATEGORY_CONFIG[ann.category] ?? CATEGORY_CONFIG.neutral;
            const Icon = cfg.icon;
            return (
              <div
                key={ann.id}
                className="flex items-start gap-2 p-2 rounded border hover:bg-muted/40 group cursor-pointer"
                onClick={() => onSeek?.(ann.timestampSeconds)}
              >
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${cfg.color}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-primary font-medium">
                      {formatTime(ann.timestampSeconds)}
                    </span>
                    <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border ${cfg.badgeClass}`}>
                      <Icon className="h-3 w-3" />
                      {cfg.label}
                    </span>
                    {ann.createdByName && (
                      <span className="text-xs text-muted-foreground">{ann.createdByName}</span>
                    )}
                  </div>
                  <p className="text-sm mt-0.5 text-foreground">{ann.comment}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0 shrink-0"
                  onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(ann.id); }}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add note form */}
      {showForm && (
        <div className="p-3 border rounded-lg bg-muted space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Thêm ghi chú mới</p>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Thời điểm (giây)</label>
              <Input
                type="number"
                min={0}
                max={recordingDuration || undefined}
                value={timeInput}
                onChange={(e) => setTimeInput(e.target.value)}
                className="h-8"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Phân loại</label>
              <Select value={category} onValueChange={(v) => setCategory(v || 'neutral')}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="good">Tốt</SelectItem>
                  <SelectItem value="bad">Cần cải thiện</SelectItem>
                  <SelectItem value="neutral">Ghi chú</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Textarea
            placeholder="Nhận xét..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            className="resize-none"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Hủy</Button>
            <Button
              size="sm"
              onClick={() => addMutation.mutate()}
              disabled={!comment.trim() || addMutation.isPending}
            >
              Lưu
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
