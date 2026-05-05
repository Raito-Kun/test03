import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { DuplicateEntry, DuplicateAction, InternalDuplicateEntry } from './contact-import-wizard-types';

interface Props {
  duplicates: DuplicateEntry[];
  uniqueCount: number;
  internalDuplicates: InternalDuplicateEntry[];
  onActionsChange: (updated: DuplicateEntry[]) => void;
  onInternalActionsChange: (updated: InternalDuplicateEntry[]) => void;
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
    <div className="border border-dashed border-border rounded-xl p-4 space-y-3 bg-card">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-[10px] font-bold font-mono uppercase text-muted-foreground tracking-wider">
          Dòng #{entry.rowNumber}
        </span>
        <Select
          value={entry.action}
          onValueChange={(v) => onChange(v as DuplicateAction)}
        >
          <SelectTrigger className="h-7 text-xs w-56 border-dashed">
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

      <div className="grid grid-cols-[80px_1fr_1fr] gap-x-3 gap-y-1 text-xs border-t border-dashed border-border pt-3">
        <span />
        <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-muted-foreground">Hiện có</span>
        <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-primary">Mới</span>
        {COMPARE_FIELDS.map(({ key, label }) => {
          const ev = existingVal(key);
          const nv = newVal(key);
          const differs = ev !== nv && nv !== '—';
          return [
            <span key={`lbl-${key}`} className="text-muted-foreground py-0.5 font-mono text-[10px] uppercase">{label}</span>,
            <span key={`ex-${key}`} className={`py-0.5 truncate text-xs ${differs ? 'bg-amber-50 text-amber-800 rounded px-1' : ''}`}>{ev}</span>,
            <span key={`nw-${key}`} className={`py-0.5 truncate text-xs ${differs ? 'bg-green-50 text-green-800 rounded px-1 font-semibold' : ''}`}>{nv}</span>,
          ];
        })}
      </div>
    </div>
  );
}

export function ContactImportStepDedup({
  duplicates, uniqueCount, internalDuplicates,
  onActionsChange, onInternalActionsChange,
}: Props) {
  function handleActionChange(rowNumber: number, action: DuplicateAction) {
    onActionsChange(setAction(duplicates, rowNumber, action));
  }

  function bulkSetAction(action: DuplicateAction) {
    onActionsChange(duplicates.map((d) => ({ ...d, action })));
  }

  function handleInternalAction(rowNumber: number, action: 'skip' | 'create') {
    onInternalActionsChange(
      internalDuplicates.map((d) => (d.rowNumber === rowNumber ? { ...d, action } : d)),
    );
  }

  function bulkSetInternal(action: 'skip' | 'create') {
    onInternalActionsChange(internalDuplicates.map((d) => ({ ...d, action })));
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
          Trùng trong DB{' '}
          <Badge variant="secondary" className="ml-1.5 text-xs">
            {duplicates.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="internal" className="text-sm">
          Trùng trong file{' '}
          <Badge variant="secondary" className="ml-1.5 text-xs">
            {internalDuplicates.length}
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
            Không phát hiện bản ghi trùng với CSDL hiện có.
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

      <TabsContent value="internal" className="space-y-3">
        {internalDuplicates.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            Không có SĐT bị lặp trong file.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Các dòng dưới đây có SĐT trùng với một dòng xuất hiện trước trong file.
              Mặc định <b>bỏ qua</b> để tránh tạo trùng. Đổi sang <b>tạo mới</b> nếu muốn ghi cả vào CSDL.
            </p>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => bulkSetInternal('skip')}>Bỏ qua tất cả</Button>
              <Button size="sm" variant="outline" onClick={() => bulkSetInternal('create')}>Tạo mới tất cả</Button>
            </div>
            <ScrollArea className="h-[360px] pr-2">
              <table className="w-full text-xs border rounded">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Dòng file</th>
                    <th className="px-2 py-1.5 text-left">Họ tên</th>
                    <th className="px-2 py-1.5 text-left">SĐT</th>
                    <th className="px-2 py-1.5 text-left">Trùng với dòng</th>
                    <th className="px-2 py-1.5 text-left w-32">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {internalDuplicates.map((d) => (
                    <tr key={d.rowNumber} className="border-t">
                      <td className="px-2 py-1 text-muted-foreground">{d.rowNumber}</td>
                      <td className="px-2 py-1">{d.new.fullName}</td>
                      <td className="px-2 py-1">{d.new.phone}</td>
                      <td className="px-2 py-1 text-muted-foreground">{d.firstOccurrenceRow}</td>
                      <td className="px-2 py-1">
                        <Select value={d.action} onValueChange={(v) => handleInternalAction(d.rowNumber, v as 'skip' | 'create')}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="skip" className="text-xs">Bỏ qua</SelectItem>
                            <SelectItem value="create" className="text-xs">Tạo mới</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}
