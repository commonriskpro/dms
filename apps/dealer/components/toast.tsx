"use client";

import * as React from "react";
import { setSuspendedToastNotifier } from "@/lib/client/lifecycle-errors";
import { Button } from "@/components/ui/button";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
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

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const addToast = React.useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  React.useEffect(() => {
    setSuspendedToastNotifier(() => {
      addToast("error", "Dealership is suspended. Changes are disabled.");
    });
    return () => setSuspendedToastNotifier(null);
  }, [addToast]);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastList toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastList({
  toasts,
  removeToast,
}: {
  toasts: ToastItem[];
  removeToast: (id: string) => void;
}) {
  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-2 rounded-lg border px-4 py-3 shadow-lg ${
            t.type === "success"
              ? "border-[var(--success)] bg-[var(--success-muted)] text-[var(--success-muted-fg)]"
              : t.type === "error"
                ? "border-[var(--danger)] bg-[var(--danger-muted)] text-[var(--danger-muted-fg)]"
                : "border-[var(--border)] bg-[var(--panel)]"
          }`}
        >
          <span className="flex-1 text-sm">{t.message}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => removeToast(t.id)}
            className="text-[var(--text-soft)] hover:text-[var(--text)] h-auto py-0 px-1 min-w-0"
            aria-label="Dismiss"
          >
            ×
          </Button>
        </div>
      ))}
    </div>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
