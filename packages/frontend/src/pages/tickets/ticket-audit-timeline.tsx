import { format } from 'date-fns';
import { Plus, Edit2, ArrowRightLeft, CheckCircle2, MessageSquare } from 'lucide-react';

interface AuditEntry {
  id: string;
  action: 'create' | 'update' | 'delete' | string;
  createdAt: string;
  user?: { fullName: string } | null;
  changes?: Record<string, { from: unknown; to: unknown }> | null;
}

interface TicketAuditTimelineProps {
  entries: AuditEntry[];
}

const ACTION_LABELS: Record<string, string> = {
  create: 'đã tạo phiếu',
  update: 'đã cập nhật',
  delete: 'đã xóa phiếu',
  note_added: 'đã thêm ghi chú',
  resolved: 'đã giải quyết',
};

const FIELD_LABELS: Record<string, string> = {
  status: 'trạng thái',
  priority: 'độ ưu tiên',
  category: 'danh mục',
  content: 'nội dung',
  resultCode: 'mã kết quả',
  assignedTo: 'phụ trách',
};

/** Node visual config per action type */
const ACTION_NODE: Record<string, { icon: React.ComponentType<{ className?: string }>; bg: string; iconColor: string }> = {
  create:     { icon: Plus,            bg: 'bg-violet-100',  iconColor: 'text-violet-600' },
  update:     { icon: Edit2,           bg: 'bg-amber-100',   iconColor: 'text-amber-600' },
  note_added: { icon: MessageSquare,   bg: 'bg-blue-100',    iconColor: 'text-blue-600' },
  resolved:   { icon: CheckCircle2,    bg: 'bg-green-100',   iconColor: 'text-green-600' },
  delete:     { icon: ArrowRightLeft,  bg: 'bg-red-100',     iconColor: 'text-red-600' },
};
const DEFAULT_NODE = { icon: ArrowRightLeft, bg: 'bg-muted', iconColor: 'text-muted-foreground' };

function humanizeAction(entry: AuditEntry): string {
  const base = ACTION_LABELS[entry.action] ?? entry.action;
  if (entry.action !== 'update' || !entry.changes) return base;

  let fields: Record<string, unknown> = entry.changes as Record<string, unknown>;
  const outerKeys = Object.keys(fields);
  if (outerKeys.length === 1 && outerKeys[0] === 'changes' && typeof fields.changes === 'object') {
    fields = fields.changes as Record<string, unknown>;
  }

  const keys = Object.keys(fields);
  if (keys.length === 0) return base;
  const labels = keys.map((k) => FIELD_LABELS[k] ?? k);
  return `${base}: ${labels.join(', ')}`;
}

export function TicketAuditTimeline({ entries }: TicketAuditTimelineProps) {
  if (!entries || entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">Chưa có lịch sử thao tác</p>
    );
  }

  const sorted = [...entries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="space-y-0 max-h-[320px] overflow-y-auto pr-1">
      {sorted.map((entry, idx) => {
        const node = ACTION_NODE[entry.action] ?? DEFAULT_NODE;
        const Icon = node.icon;
        const isLast = idx === sorted.length - 1;

        return (
          <div key={entry.id} className="relative flex gap-3">
            {/* Vertical dashed connector */}
            {!isLast && (
              <div className="absolute left-[11px] top-6 bottom-0 w-px border-l border-dashed border-border" />
            )}
            {/* Node */}
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${node.bg} border-2 border-background shadow-sm z-10 mt-0.5`}>
              <Icon className={`h-3 w-3 ${node.iconColor}`} />
            </div>
            {/* Content */}
            <div className="flex-1 pb-5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold text-foreground leading-tight">
                  {entry.user?.fullName ?? 'Hệ thống'}
                  {' '}
                  <span className="font-normal text-muted-foreground">
                    {humanizeAction(entry)}
                  </span>
                </p>
                <span className="font-mono text-[10px] text-muted-foreground shrink-0 tabular-nums">
                  {format(new Date(entry.createdAt), 'HH:mm dd/MM')}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
