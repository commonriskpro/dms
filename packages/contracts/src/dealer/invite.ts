/**
 * Dealer invite (resolve / accept) structured error codes for UI messaging.
 * Use these codes in API error responses; do not expose tokens or PII.
 */
export const DEALER_INVITE_ERROR_CODES = [
  "INVITE_NOT_FOUND",
  "INVITE_EXPIRED",
  "INVITE_ALREADY_ACCEPTED",
  "INVITE_MEMBERSHIP_EXISTS",
] as const;

export type DealerInviteErrorCode = (typeof DEALER_INVITE_ERROR_CODES)[number];
