import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { DuplicateEntry, DuplicateAction } from './contact-import-wizard-types';

interface Props {
  duplicates: DuplicateEntry[];
  uniqueCount: number;
  onActionsChange: (updated: DuplicateEntry[]) => void;
}

const ACTION_LABELS: Record<DuplicateAction, string> = {
  keep: 'Giữ dữ liệu cũ',
  overwrite: 'Ghi đè bằng dữ liệu mới',
  merge: 'Gộp (giữ cũ, bổ sung ô trống từ mới)',
  skip: 'Bỏ qua',
  create: 'Tạo mới',
};

const COMPARE_FIELDS: { key: string; label: string }[] = [
  { key: 'fullName', label: 'Họ tên' },
  { key: 'phone', label: 'Điện thoại' },
  { key: 'email', label: 'Email' },
  { key: 'company', label: 'Công ty' },
  { key: 'address', label: 'Địa chỉ' },
  { key: 'idNumber', label: 'CMND/CCCD' },
];

function setAction(
  duplicates: DuplicateEntry[],
  rowNumber: number,
  action: DuplicateAction,
): DuplicateEntry[] {
  return duplicates.map((d) => (d.rowNumber === rowNumber ? { ...d, action } : d));
}

function DuplicateCard({
  entry,
  onChange,
}: {
  entry: DuplicateEntry;
  onChange: (action: DuplicateAction) => void;
}) {
  const existingVal = (key: string): string =>
    ((entry.existing as unknown as Record<string, unknown>)[key] as string) ?? '—';
  const newVal = (key: string): string =>
    ((entry.new as unknown as Record<string, unknown>)[key] as string) ?? '—';

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-white">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs text-muted-foreground">Dòng #{entry.rowNumber}</span>
        <Select
          value={entry.action}
          onValueChange={(v) => onChange(v as DuplicateAction)}
        >
          <SelectTrigger className="h-7 text-xs w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(['keep', 'overwrite', 'merge', 'skip'] as DuplicateAction[]).map((a) => (
              <SelectItem key={a} value={a} className="text-xs">
                {ACTION_LABELS[a]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-[80px_1fr_1fr] gap-x-2 gap-y-0.5 text-xs">
        <span />
        <span className="font-medium text-muted-foreground">Hiện có</span>
        <span className="font-medium text-muted-foreground">Mới</span>
        {COMPARE_FIELDS.map(({ key, label }) => {
          const ev = existingVal(key);
          const nv = newVal(key);
          const differs = ev !== nv && nv !== '—';
          return [
            <span key={`lbl-${key}`} className="text-muted-foreground py-0.5">{label}</span>,
            <span key={`ex-${key}`} className={`py-0.5 truncate ${differs ? 'bg-amber-50 rounded px-1' : ''}`}>{ev}</span>,
            <span key={`nw-${key}`} className={`py-0.5 truncate ${differs ? 'bg-amber-50 rounded px-1 font-medium' : ''}`}>{nv}</span>,
          ];
        })}
      </div>
    </div>
  );
}

export function ContactImportStepDedup({ duplicates, uniqueCount, onActionsChange }: Props) {
  function handleActionChange(rowNumber: number, action: DuplicateAction) {
    onActionsChange(setAction(duplicates, rowNumber, action));
  }

  function bulkSetAction(action: DuplicateAction) {
    onActionsChange(duplicates.map((d) => ({ ...d, action })));
  }

  return (
    <Tabs defaultValue="unique" className="w-full">
      <TabsList className="mb-3">
        <TabsTrigger value="unique" className="text-sm">
          Không trùng{' '}
          <Badge variant="secondary" className="ml-1.5 text-xs">
            {uniqueCount}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="duplicate" className="text-sm">
          Trùng lặp{' '}
          <Badge variant="secondary" className="ml-1.5 text-xs">
            {duplicates.length}
          </Badge>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="unique">
        <p className="text-sm text-muted-foreground py-2">
          Tất cả bản ghi này sẽ được thêm mới và đã được chọn mặc định.
        </p>
      </TabsContent>

      <TabsContent value="duplicate" className="space-y-3">
        {duplicates.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            Không phát hiện bản ghi trùng lặp.
          </p>
        ) : (
          <>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" onClick={() => bulkSetAction('merge')}>
                Tự động gộp trùng
              </Button>
              <Button size="sm" variant="outline" onClick={() => bulkSetAction('keep')}>
                Giữ tất cả
              </Button>
            </div>
            <ScrollArea className="h-[420px] pr-2">
              <div className="space-y-3">
                {duplicates.map((entry) => (
                  <DuplicateCard
                    key={entry.rowNumber}
                    entry={entry}
                    onChange={(action) => handleActionChange(entry.rowNumber, action)}
                  />
                ))}
              </div>
            </ScrollArea>
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}
