export interface SessionUser {
  id: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
}

export interface SessionDealership {
  id: string;
  name: string;
}

export interface SessionPlatformAdmin {
  isAdmin: boolean;
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
  platformAdmin: SessionPlatformAdmin;
  pendingApproval: boolean;
  /** True when viewing as dealer via platform support session. */
  isSupportSession?: boolean;
  /** Platform user id who started the support session (when isSupportSession). */
  supportSessionPlatformUserId?: string;
}
