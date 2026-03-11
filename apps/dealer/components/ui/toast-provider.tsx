"use client";

import * as React from "react";
import {
  ToastProvider as RadixToastProvider,
  ToastViewport,
  Toast,
  ToastDescription,
  ToastClose,
} from "@radix-ui/react-toast";
import { setSuspendedToastNotifier } from "@/lib/client/lifecycle-errors";
import { setToastNotifier, type ToastVariant } from "@/lib/ui/toast";

const TOAST_DURATION = 5000;

type ToastType = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

type ToastContextValue = {
  toasts: ToastItem[];
  addToast: (type: ToastType, message: string) => void;
  removeToast: (id: string) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

const variantRootClass: Record<ToastType, string> = {
  success:
    "bg-[var(--success-surface)] text-[var(--success-text)] border-[var(--border)] shadow-[var(--shadow-card)]",
  error:
    "bg-[var(--danger-surface)] text-[var(--danger-text)] border-[var(--border)] shadow-[var(--shadow-card)]",
  warning:
    "bg-[var(--warning-surface)] text-[var(--warning-text)] border-[var(--border)] shadow-[var(--shadow-card)]",
  info: "bg-[var(--info-surface)] text-[var(--info-text)] border-[var(--border)] shadow-[var(--shadow-card)]",
};

function ToastList({
  toasts,
  removeToast,
}: {
  toasts: ToastItem[];
  removeToast: (id: string) => void;
}) {
  return (
    <>
      {toasts.map((t) => (
        <Toast
          key={t.id}
          open
          duration={TOAST_DURATION}
          onOpenChange={(open) => {
            if (!open) removeToast(t.id);
          }}
          className={`flex w-full items-start gap-2 rounded-[var(--radius-card)] border px-4 py-3 ${variantRootClass[t.type]}`}
        >
          <ToastDescription className="flex-1 text-sm">
            {t.message}
          </ToastDescription>
          <ToastClose
            className="rounded-[var(--radius-button)] p-1 text-[var(--text-soft)] hover:bg-[var(--muted)] hover:text-[var(--text)] focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            aria-label="Dismiss"
          >
            ×
          </ToastClose>
        </Toast>
      ))}
    </>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const addToast = React.useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  React.useEffect(() => {
    const notifier = (variant: ToastVariant, message: string) => {
      addToast(variant, message);
    };
    setToastNotifier(notifier);
    return () => setToastNotifier(null);
  }, [addToast]);

  React.useEffect(() => {
    setSuspendedToastNotifier(() => {
      addToast("error", "Dealership is suspended. Changes are disabled.");
    });
    return () => setSuspendedToastNotifier(null);
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      <RadixToastProvider duration={TOAST_DURATION} label="Notifications">
        {children}
        <ToastViewport
          className="fixed bottom-4 left-4 right-4 z-[100] flex max-h-screen flex-col-reverse gap-2 p-0 sm:left-auto sm:right-4 sm:max-w-[420px]"
          aria-label="Notifications (F8)"
        />
        <ToastList toasts={toasts} removeToast={removeToast} />
      </RadixToastProvider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
