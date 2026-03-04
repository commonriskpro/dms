/**
 * Centralized handling for tenant lifecycle errors (SUSPENDED/CLOSED) from API.
 * Toast provider registers a notifier; apiFetch calls it on 403 TENANT_SUSPENDED (with dedupe).
 * TENANT_CLOSED is handled by redirect in apiFetch.
 */

const SUSPENDED_TOAST_COOLDOWN_MS = 5000;

let suspendedNotifier: (() => void) | null = null;
let lastSuspendedToastAt = 0;

export function setSuspendedToastNotifier(notifier: (() => void) | null): void {
  suspendedNotifier = notifier;
}

export function notifySuspendedOnce(): void {
  const now = Date.now();
  if (now - lastSuspendedToastAt < SUSPENDED_TOAST_COOLDOWN_MS) return;
  lastSuspendedToastAt = now;
  suspendedNotifier?.();
}
