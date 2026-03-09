"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

const RESEND_SUCCESS = "If your email is not yet verified, you will receive a verification link.";
const RESEND_ERROR_GENERIC = "Something went wrong. Try again later.";

export function PlatformUnverifiedEmailBanner({ emailVerified = true }: { emailVerified?: boolean }) {
  const [dismissed, setDismissed] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  const show = !dismissed && !emailVerified;

  const handleResend = async () => {
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch("/api/platform/auth/verify-email/resend", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error?.message ?? RESEND_ERROR_GENERIC;
        setMessage({ type: "error", text: msg });
        return;
      }
      setMessage({ type: "success", text: data?.message ?? RESEND_SUCCESS });
    } catch {
      setMessage({ type: "error", text: RESEND_ERROR_GENERIC });
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm border-b border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"
    >
      <div className="flex flex-1 items-center gap-3 min-w-0">
        <span className="font-medium">Verify your email to secure your account.</span>
        {message && (
          <span
            className={
              message.type === "success"
                ? "text-[var(--muted-text)]"
                : "text-[var(--danger)]"
            }
          >
            {message.text}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleResend}
          disabled={loading}
        >
          {loading ? "Sending…" : "Resend verification email"}
        </Button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded p-1 text-[var(--muted-text)] hover:text-[var(--text)] hover:bg-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          aria-label="Dismiss banner"
        >
          <span className="sr-only">Dismiss</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
