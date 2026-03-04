/**
 * UI helpers for platform users page. Used for OWNER-only invite button visibility; testable without rendering.
 */
export function isInviteButtonVisible(role: string | null): boolean {
  return role === "PLATFORM_OWNER";
}
