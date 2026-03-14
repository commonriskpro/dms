/**
 * Shared string enums and constants. No Prisma, no Supabase, no env.
 */

export const DEALER_LIFECYCLE_STATUS = ["ACTIVE", "SUSPENDED", "CLOSED"] as const;
export type DealershipLifecycleStatus = (typeof DEALER_LIFECYCLE_STATUS)[number];

export const APPLICATION_STATUS = [
  "APPLIED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUS)[number];

export const DEALER_APPLICATION_SOURCE = ["invite", "public_apply"] as const;
export type DealerApplicationSource = (typeof DEALER_APPLICATION_SOURCE)[number];

export const DEALER_APPLICATION_STATUS = [
  "draft",
  "invited",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "activation_sent",
  "activated",
] as const;
export type DealerApplicationStatus = (typeof DEALER_APPLICATION_STATUS)[number];

export const PLATFORM_ROLES = [
  "PLATFORM_OWNER",
  "PLATFORM_COMPLIANCE",
  "PLATFORM_SUPPORT",
] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

/** JWT audience for dealer internal API */
export const INTERNAL_API_AUD = "dealer-internal";
/** JWT issuer for platform service */
export const INTERNAL_API_ISS = "platform";
/** JWT audience for support-session token (platform → dealer consume) */
export const SUPPORT_SESSION_AUD = "support_session";
