import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

export interface TicketResolutionDialogProps {
  open: boolean;
  ticketCode?: string;
  onCancel: () => void;
  onConfirm: (input: { resultCode: string; note: string }) => void | Promise<void>;
}

const RESULT_CODES = [
  { value: 'resolved_first_contact', label: 'Giải quyết ngay lần đầu' },
  { value: 'resolved_callback',      label: 'Giải quyết qua gọi lại' },
  { value: 'resolved_escalated',     label: 'Giải quyết sau leo thang' },
  { value: 'customer_satisfied',     label: 'Khách hàng hài lòng' },
  { value: 'no_action_needed',       label: 'Không cần xử lý thêm' },
  { value: 'other',                  label: 'Khác' },
];

/** Mono uppercase field label */
function FieldLabel({ children, required: req }: { children: React.ReactNode; required?: boolean }) {
  return (
    <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
      {children}
      {req && <span className="text-destructive ml-1">*</span>}
    </Label>
  );
}

export function TicketResolutionDialog({ open, ticketCode, onCancel, onConfirm }: TicketResolutionDialogProps) {
  const [resultCode, setResultCode] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ resultCode?: string; note?: string }>({});

  function validate() {
    const e: typeof errors = {};
    if (!resultCode) e.resultCode = 'Vui lòng chọn mã kết quả';
    if (!note.trim()) e.note = 'Vui lòng nhập ghi chú';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleConfirm() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await onConfirm({ resultCode, note: note.trim() });
      setResultCode('');
      setNote('');
      setErrors({});
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancel() {
    setResultCode('');
    setNote('');
    setErrors({});
    onCancel();
  }

  const dialogTitle = ticketCode
    ? `Đóng phiếu ghi ${ticketCode}`
    : 'Giải quyết phiếu ghi';

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleCancel(); }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader className="border-b border-dashed border-border pb-4">
          <DialogTitle className="font-mono text-base font-bold text-foreground">
            {dialogTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Result code */}
          <div className="space-y-1.5">
            <FieldLabel required>Mã kết quả</FieldLabel>
            <Select value={resultCode} onValueChange={(v) => { if (v) setResultCode(v); }}>
              <SelectTrigger
                className={`h-[42px] font-mono text-sm ${errors.resultCode ? 'border-destructive' : 'border-dashed'}`}
              >
                <SelectValue placeholder="Chọn mã kết quả..." />
              </SelectTrigger>
              <SelectContent>
                {RESULT_CODES.map((rc) => (
                  <SelectItem key={rc.value} value={rc.value} className="font-mono text-sm">
                    {rc.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.resultCode && (
              <p className="text-xs text-destructive">{errors.resultCode}</p>
            )}
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <FieldLabel required>Ghi chú giải quyết</FieldLabel>
            <Textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Mô tả cách giải quyết vấn đề..."
              className={`resize-none ${errors.note ? 'border-destructive' : 'border-dashed'}`}
            />
            {errors.note && (
              <p className="text-xs text-destructive">{errors.note}</p>
            )}
          </div>
        </div>

        <DialogFooter className="border-t border-dashed border-border pt-4 gap-2">
          <Button
            variant="outline"
            className="border-dashed"
            onClick={handleCancel}
            disabled={submitting}
          >
            Hủy
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={submitting}
            className="bg-primary text-primary-foreground shadow-md shadow-primary/20 min-w-[130px]"
          >
            {submitting ? 'Đang lưu...' : 'Đóng phiếu'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
