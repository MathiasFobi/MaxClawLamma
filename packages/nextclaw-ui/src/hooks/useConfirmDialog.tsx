import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
};

type ConfirmState = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  variant: 'default' | 'destructive';
  resolve: ((value: boolean) => void) | null;
};

const initial: ConfirmState = {
  open: false,
  title: '',
  description: '',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  variant: 'default',
  resolve: null
};

export function useConfirmDialog(): {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  ConfirmDialog: () => ReactNode;
} {
  const [state, setState] = useState<ConfirmState>(initial);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        open: true,
        title: options.title,
        description: options.description ?? '',
        confirmLabel: options.confirmLabel ?? 'Confirm',
        cancelLabel: options.cancelLabel ?? 'Cancel',
        variant: options.variant ?? 'default',
        resolve: (value) => {
          resolve(value);
          setState((s) => ({ ...s, open: false, resolve: null }));
        }
      });
    });
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    setState((s) => {
      if (!open && s.resolve) {
        s.resolve(false);
      }
      return { ...s, open, resolve: open ? s.resolve : null };
    });
  }, []);

  const ConfirmDialogEl = useCallback(
    () => (
      <ConfirmDialog
        open={state.open}
        onOpenChange={handleOpenChange}
        title={state.title}
        description={state.description || undefined}
        confirmLabel={state.confirmLabel}
        cancelLabel={state.cancelLabel}
        variant={state.variant}
        onConfirm={() => state.resolve?.(true)}
        onCancel={() => state.resolve?.(false)}
      />
    ),
    [state, handleOpenChange]
  );

  return { confirm, ConfirmDialog: ConfirmDialogEl };
}
