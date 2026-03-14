"use client";

import * as React from "react";

type Toast = { id: string; message: string; type: "success" | "error" };

const ToastContext = React.createContext<{
  toast: (message: string, type: "success" | "error") => void;
} | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const toast = React.useCallback((message: string, type: "success" | "error") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`glass-elevated rounded-md border px-4 py-2 text-sm shadow-[var(--glass-shadow-lg)] ${
              t.type === "success"
                ? "border-[color-mix(in_srgb,var(--success)_45%,var(--glass-border))] bg-[color-mix(in_srgb,var(--success)_12%,var(--glass-bg-strong))] text-[var(--text)]"
                : "border-[color-mix(in_srgb,var(--danger)_45%,var(--glass-border))] bg-[color-mix(in_srgb,var(--danger)_12%,var(--glass-bg-strong))] text-[var(--text)]"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  return ctx?.toast ?? (() => {});
}
