export interface SessionUser {
  id: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
  /** True when Supabase user has email_confirmed_at (session only). */
  emailVerified?: boolean;
}

export interface SessionDealership {
  id: string;
  name: string;
}

export type SessionLifecycleStatus = "ACTIVE" | "SUSPENDED" | "CLOSED";

export interface SessionResponse {
  user: SessionUser;
  activeDealership: SessionDealership | null;
  lifecycleStatus: SessionLifecycleStatus | null;
  /** When lifecycleStatus is SUSPENDED, optional reason from platform (if available). */
  lastStatusReason?: string | null;
  closedDealership: SessionDealership | null;
  permissions: string[];
  pendingApproval: boolean;
  /** True when viewing as dealer via platform support session. */
  isSupportSession?: boolean;
  /** Platform user id who started the support session (when isSupportSession). */
  supportSessionPlatformUserId?: string;
  /** True when user's email is verified (Supabase email_confirmed_at). Omitted or true for support session. */
  emailVerified?: boolean;
}
