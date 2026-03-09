/**
 * Session list/revoke helpers. Supabase does not expose multi-session listing;
 * we return the current session only and support revoke-all-others.
 */

import { createHash } from "crypto";

export type SessionItem = {
  id: string;
  current: boolean;
  createdAt: string;
  lastActiveAt?: string;
};

/** Derive a stable, opaque session id (no token leakage). */
export function sessionIdFromAccessToken(accessToken: string): string {
  return createHash("sha256").update(accessToken).digest("hex").slice(0, 24);
}
