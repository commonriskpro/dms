/**
 * Feature flags. All push-related behavior is gated here.
 * Default: push OFF so the app is safe to ship without paid account or credentials.
 */
export const ENABLE_PUSH_NOTIFICATIONS = false;

export function getPushFeatureEnabled(): boolean {
  return ENABLE_PUSH_NOTIFICATIONS;
}
