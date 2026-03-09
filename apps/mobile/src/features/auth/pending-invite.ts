/**
 * In-memory pending invite token for "Sign in to accept" flow.
 * After login, AuthGate checks this and redirects to accept-invite with the token.
 */

let pendingToken: string | null = null;

export function getPendingInviteToken(): string | null {
  return pendingToken;
}

export function setPendingInviteToken(token: string): void {
  pendingToken = token;
}

export function clearPendingInviteToken(): void {
  pendingToken = null;
}
