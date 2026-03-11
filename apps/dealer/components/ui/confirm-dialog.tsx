"use client";

import * as React from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { Button } from "@/components/ui/button";

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "default";
};

type PendingConfirm = {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
};

const ConfirmDialogContext = React.createContext<
  ((options: ConfirmOptions) => Promise<boolean>) | null
>(null);

export function useConfirm() {
  const confirmFn = React.useContext(ConfirmDialogContext);
  if (!confirmFn) {
    throw new Error("useConfirm must be used within ConfirmDialogProvider");
  }
  return confirmFn;
}

/**
 * Imperative confirm dialog. Returns a promise that resolves to true (confirm) or false (cancel/ESC).
 * Use from components under ConfirmDialogProvider, or use the global confirm() after mounting the provider.
 */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  return getConfirmSingleton().confirm(options);
}

type ConfirmSingleton = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  setProvider: (fn: (options: ConfirmOptions) => Promise<boolean>) => void;
};

function getConfirmSingleton(): ConfirmSingleton {
  const g = typeof globalThis !== "undefined" ? globalThis : ({} as Window);
  const key = "__dms_confirm_dialog_singleton__" as const;
  if (!(key in g)) {
    let providerFn: ((options: ConfirmOptions) => Promise<boolean>) | null = null;
    (g as Record<string, unknown>)[key] = {
      confirm(options: ConfirmOptions) {
        if (!providerFn) {
          return Promise.resolve(false);
        }
        return providerFn(options);
      },
      setProvider(fn: (options: ConfirmOptions) => Promise<boolean>) {
        providerFn = fn;
      },
    };
  }
  return (g as unknown as Record<string, ConfirmSingleton>)[key];
}

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = React.useState<PendingConfirm | null>(null);

  const confirmFn = React.useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ options, resolve });
    });
  }, []);

  const finish = React.useCallback((value: boolean) => {
    setPending((prev) => {
      if (prev) prev.resolve(value);
      return null;
    });
  }, []);

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open && pending) {
        finish(false);
      }
    },
    [pending, finish]
  );

  React.useEffect(() => {
    getConfirmSingleton().setProvider(confirmFn);
    return () => getConfirmSingleton().setProvider(() => Promise.resolve(false));
  }, [confirmFn]);

  return (
    <ConfirmDialogContext.Provider value={confirmFn}>
      {children}
      {pending && (
        <ConfirmDialogInner
          key={pending.options.title}
          options={pending.options}
          open
          onOpenChange={handleOpenChange}
          onConfirm={() => finish(true)}
          onCancel={() => finish(false)}
        />
      )}
    </ConfirmDialogContext.Provider>
  );
}

const contentClass =
  "fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card-hover)] focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95";
const overlayClass =
  "fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0";

function ConfirmDialogInner({
  options,
  open,
  onOpenChange,
  onConfirm,
  onCancel,
}: {
  options: ConfirmOptions;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const {
    title,
    description,
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = "default",
  } = options;

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={overlayClass} />
        <AlertDialog.Content
          className={contentClass}
          onEscapeKeyDown={() => {
            onCancel();
          }}
        >
          <AlertDialog.Title className="text-lg font-semibold text-[var(--text)]">
            {title}
          </AlertDialog.Title>
          {description != null && (
            <AlertDialog.Description className="mt-2 text-sm text-[var(--muted-text)]">
              {description}
            </AlertDialog.Description>
          )}
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button
                type="button"
                variant="secondary"
                className="border-[var(--border)] bg-transparent hover:bg-[var(--muted)]"
              >
                {cancelText}
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button
                type="button"
                variant={variant === "danger" ? "danger" : "primary"}
                onClick={onConfirm}
              >
                {confirmText}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
