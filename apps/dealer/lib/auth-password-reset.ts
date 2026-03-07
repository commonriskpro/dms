/**
 * Helpers for password reset flow. Server-only.
 * - Redirect URL for reset link (no PII in logs).
 * - Normalized error message for reset (no enumeration).
 */

export function getPasswordResetRedirectUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return `${base.replace(/\/$/, "")}/reset-password`;
}

/** Generic user-facing message for invalid/expired reset context. */
export const RESET_PASSWORD_INVALID_CONTEXT_MESSAGE =
  "This link has expired or was already used. Please request a new password reset.";
