import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Download } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import api from '@/services/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { ImportStepPreview } from './contact-import-step-preview';
import { ContactImportStepDedup as ImportStepDedup } from './contact-import-step-dedup';
import { ContactImportStepAssign as ImportStepAssign } from './contact-import-step-assign';
import type {
  ContactImportRow, DuplicateEntry, ExistingContactSnapshot, CommitRow, DuplicateAction,
} from './contact-import-wizard-types';

type AssignmentPlan = Map<number, string | null>;
type ImportError = { row: number; error: string };

const ALLOWED_ROLES = ['super_admin', 'admin', 'manager', 'leader'] as const;
const STEP_LABELS = ['1 Xem trước', '2 Kiểm tra trùng', '3 Phân công'];

// ---- state shape ----
interface WizardState {
  step: 1 | 2 | 3;
  // step 1
  rows: ContactImportRow[];
  totalRaw: number;
  errors: ImportError[];
  // step 2 — duplicates carry their own chosen action (step 2 component mutates via onActionsChange)
  uniques: ContactImportRow[];
  duplicates: DuplicateEntry[];
  // step 3
  assignmentPlan: AssignmentPlan;
}

function initialState(): WizardState {
  return {
    step: 1,
    rows: [],
    totalRaw: 0,
    errors: [],
    uniques: [],
    duplicates: [],
    assignmentPlan: new Map(),
  };
}

// ---- Stepper ----
function Stepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {STEP_LABELS.map((label, i) => {
        const stepNum = (i + 1) as 1 | 2 | 3;
        const active = stepNum === current;
        const done = stepNum < current;
        return (
          <div key={label} className="flex items-center gap-1.5">
            {i > 0 && <div className="h-px w-6 bg-border" />}
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full transition-colors ${
                active ? 'bg-primary text-primary-foreground' :
                done ? 'bg-muted text-muted-foreground line-through' :
                'text-muted-foreground'
              }`}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---- Dialog internals ----
interface ContactImportWizardProps {
  open: boolean;
  onClose: () => void;
}

export function ContactImportWizard({ open, onClose }: ContactImportWizardProps) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<WizardState>(initialState);

  function resetAndClose() {
    setState(initialState());
    onClose();
  }

  // Step 1 — upload preview
  const previewMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post<{
        data: { totalRaw: number; validCount: number; errorCount: number; rows: ContactImportRow[]; errors: ImportError[] };
      }>('/contacts/import/preview', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data;
    },
    onSuccess: (result) => {
      setState((s) => ({
        ...s,
        rows: result.rows,
        totalRaw: result.totalRaw,
        errors: result.errors,
      }));
    },
    onError: (err: { response?: { data?: { error?: { message?: string } } }; message?: string }) => {
      toast.error(err?.response?.data?.error?.message || err?.message || 'Tải file thất bại');
    },
  });

  // Step 2 — dedup check + advance
  const dedupMutation = useMutation({
    mutationFn: async (rows: ContactImportRow[]) => {
      const { data } = await api.post<{
        data: {
          uniques: ContactImportRow[];
          duplicates: Array<{ rowNumber: number; new: ContactImportRow; existing: ExistingContactSnapshot }>;
        };
      }>('/contacts/import/check-dedup', { rows });
      return data.data;
    },
    onSuccess: (result) => {
      const duplicates: DuplicateEntry[] = result.duplicates.map((d) => ({
        ...d,
        action: 'merge' as DuplicateAction,
      }));
      setState((s) => ({ ...s, step: 2, uniques: result.uniques, duplicates }));
    },
    onError: (err: { response?: { data?: { error?: { message?: string } } }; message?: string }) => {
      toast.error(err?.response?.data?.error?.message || err?.message || 'Kiểm tra trùng thất bại');
    },
  });

  // Step 3 — commit
  const commitMutation = useMutation({
    mutationFn: async (rows: CommitRow[]) => {
      const { data } = await api.post<{
        data: { created: number; updated: number; skipped: number; assigned: number; errors: ImportError[] };
      }>('/contacts/import/commit', { rows });
      return data.data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      const msg = `Đã tạo ${result.created}, cập nhật ${result.updated}, bỏ qua ${result.skipped}`;
      if (result.errors?.length > 0) {
        const details = result.errors.slice(0, 3).map((e) => `Dòng ${e.row}: ${e.error}`).join('\n');
        toast.warning(msg, { description: details, duration: 10000 });
      } else {
        toast.success(msg);
      }
      resetAndClose();
    },
    onError: (err: { response?: { data?: { error?: { message?: string } } }; message?: string }) => {
      toast.error(err?.response?.data?.error?.message || err?.message || 'Hoàn tất import thất bại');
    },
  });

  function handleNext() {
    if (state.step === 1) {
      if (!state.rows.length) { toast.error('Vui lòng tải file trước'); return; }
      dedupMutation.mutate(state.rows);
    } else if (state.step === 2) {
      setState((s) => ({ ...s, step: 3 }));
    } else {
      // Build CommitRow[] — one entry per row the backend will act on.
      const uniquesOut: CommitRow[] = state.uniques.map((r) => ({
        row: r,
        action: 'create',
        assignToUserId: state.assignmentPlan.get(r.rowNumber) ?? null,
      }));
      const duplicatesOut: CommitRow[] = state.duplicates.map((d) => ({
        row: d.new,
        action: d.action,
        existingId: d.existing.id,
        assignToUserId: state.assignmentPlan.get(d.rowNumber) ?? null,
      }));
      commitMutation.mutate([...uniquesOut, ...duplicatesOut]);
    }
  }

  const isLoading = previewMutation.isPending || dedupMutation.isPending || commitMutation.isPending;
  const isStep3 = state.step === 3;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetAndClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nhập danh bạ</DialogTitle>
        </DialogHeader>

        <Stepper current={state.step} />

        {state.step === 1 && (
          <ImportStepPreview
            rows={state.rows}
            totalRaw={state.totalRaw}
            errors={state.errors}
            uploading={previewMutation.isPending}
            onUpload={(file) => previewMutation.mutate(file)}
          />
        )}

        {state.step === 2 && (
          <ImportStepDedup
            duplicates={state.duplicates}
            uniqueCount={state.uniques.length}
            onActionsChange={(updated) => setState((s) => ({ ...s, duplicates: updated }))}
          />
        )}

        {state.step === 3 && (
          <ImportStepAssign
            uniques={state.uniques}
            duplicates={state.duplicates}
            onAssignmentChange={(plan: AssignmentPlan) =>
              setState((s) => ({ ...s, assignmentPlan: plan }))
            }
          />
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={resetAndClose} disabled={isLoading}>
            Hủy
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setState((s) => ({ ...s, step: (s.step - 1) as 1 | 2 | 3 }))}
              disabled={state.step === 1 || isLoading}
            >
              Quay lại
            </Button>
            <Button onClick={handleNext} disabled={isLoading}>
              {isLoading
                ? 'Đang xử lý...'
                : isStep3
                ? 'Hoàn tất'
                : 'Tiếp tục'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// UTF-8 BOM prefix so Excel renders Vietnamese diacritics correctly when opening CSV.
function downloadContactTemplate() {
  const rows = [
    ['Họ tên', 'Số điện thoại', 'Email', 'Nguồn', 'Ghi chú'],
    ['Nguyễn Văn An', '0901234567', 'an.nguyen@example.com', 'website', 'Khách quan tâm gói VIP'],
    ['Trần Thị Bình', '0912345678', 'binh.tran@example.com', 'zalo', 'Liên hệ lại sau 2 ngày'],
    ['Lê Hoàng Cường', '0987654321', '', 'facebook', ''],
  ];
  const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'template_khach_hang.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---- Trigger button (composes dialog with own open state) ----
export function ContactImportWizardButton() {
  const { user } = useAuthStore();
  const [open, setOpen] = useState(false);

  const allowed = ALLOWED_ROLES.includes((user?.role ?? '') as typeof ALLOWED_ROLES[number]);
  if (!allowed) return null;

  return (
    <>
      <Button variant="outline" size="sm" onClick={downloadContactTemplate} className="gap-1.5" title="Tải template mẫu CSV">
        <Download className="h-4 w-4" />
        Tải template mẫu
      </Button>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Upload className="h-4 w-4" />
        Nhập danh bạ
      </Button>
      <ContactImportWizard open={open} onClose={() => setOpen(false)} />
    </>
  );
}
