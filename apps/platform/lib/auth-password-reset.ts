/**
 * Helpers for platform password reset flow. Server-only.
 */

export function getPlatformPasswordResetRedirectUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3001");
  return `${base.replace(/\/$/, "")}/platform/reset-password`;
}

export const PLATFORM_RESET_PASSWORD_INVALID_CONTEXT_MESSAGE =
  "This link has expired or was already used. Please request a new password reset.";
