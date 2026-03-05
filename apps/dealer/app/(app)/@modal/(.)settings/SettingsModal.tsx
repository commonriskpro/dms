"use client";

import { useRouter } from "next/navigation";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SettingsContent } from "@/modules/settings/ui/SettingsContent";

const modalContentClass =
  "relative z-50 flex flex-col w-full max-w-[1040px] max-h-[85vh] h-[100dvh] sm:h-auto sm:max-h-[85vh] rounded-none sm:rounded-[var(--radius-card)] border-0 sm:border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card-hover)] p-0 overflow-hidden";

export function SettingsModal() {
  const router = useRouter();

  const handleClose = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && handleClose()}
      contentClassName={modalContentClass}
    >
      <DialogHeader className="flex flex-row items-center justify-between px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b border-[var(--border)] shrink-0">
        <DialogTitle className="text-base font-semibold text-[var(--text)] text-left mb-0">
          Settings
        </DialogTitle>
        <button
          type="button"
          onClick={handleClose}
          className="h-8 w-8 rounded-[var(--radius-button)] flex items-center justify-center text-[var(--muted-text)] hover:bg-[var(--muted)] hover:text-[var(--text)] transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-0"
          aria-label="Close settings"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </DialogHeader>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
        <SettingsContent />
      </div>
    </Dialog>
  );
}
