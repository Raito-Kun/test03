import { VI } from '@/lib/vi-text';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  loading?: boolean;
}

export function ConfirmDialog({
  open, onClose, onConfirm, title, description, loading,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title || VI.confirmDelete}</DialogTitle>
          <DialogDescription>{description || VI.confirmDeleteDesc}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{VI.actions.cancel}</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading}>{VI.actions.confirm}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
