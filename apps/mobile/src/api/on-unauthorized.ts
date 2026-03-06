/**
 * Optional callback when API client gets 401 after one retry.
 * Set by AuthProvider so the app can sign out and redirect.
 * Never log tokens or session data.
 */
let onUnauthorized: (() => void) | null = null;

export function setOnUnauthorized(cb: (() => void) | null): void {
  onUnauthorized = cb;
}

export function getOnUnauthorized(): (() => void) | null {
  return onUnauthorized;
}
