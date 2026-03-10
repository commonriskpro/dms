/**
 * Fetch wrapper for /api/platform/*. Same-origin only; credentials included.
 * When options.platformUserId is set (e.g. from usePlatformFetch), adds X-Platform-User-Id for header auth.
 *
 * Base URL: In the browser we use NEXT_PUBLIC_APP_URL (set in Vercel to your deployment URL) so
 * requests always hit the same origin; fallback to window.location.origin. Server-side uses
 * NEXT_PUBLIC_PLATFORM_ORIGIN or localhost for server-to-server.
 */

export type ApiError = { code: string; message: string; details?: unknown };

function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (appUrl && (appUrl.startsWith("http://") || appUrl.startsWith("https://"))) {
      return appUrl.replace(/\/$/, "");
    }
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_PLATFORM_ORIGIN ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
}

export type PlatformFetchOptions = RequestInit & {
  params?: Record<string, string>;
  platformUserId?: string | null;
};

export async function platformFetch<T>(
  path: string,
  options: PlatformFetchOptions = {}
): Promise<{ data: T; ok: true } | { error: ApiError; ok: false; status: number }> {
  const { params, platformUserId, ...init } = options;
  const base = getBaseUrl();
  const url = new URL(path, base);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (init.headers) {
    const h = init.headers as HeadersInit;
    if (h instanceof Headers) {
      h.forEach((v, k) => { headers[k] = v; });
    } else if (Array.isArray(h)) {
      h.forEach(([k, v]) => { headers[k] = v; });
    } else {
      Object.assign(headers, h);
    }
  }
  if (platformUserId) headers["x-platform-user-id"] = platformUserId;
  const res = await fetch(url.toString(), {
    ...init,
    headers,
    credentials: "same-origin",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: (json.error as ApiError) ?? { code: "UNKNOWN", message: res.statusText },
    };
  }
  return { ok: true, data: json as T };
}

export type ListMeta = { total: number; limit: number; offset: number };

export type ApplicationsListRes = { data: ApplicationListItem[]; meta: ListMeta };
export type ApplicationDetailRes = ApplicationDetail;

export type ApplicationListItem = {
  id: string;
  status: string;
  legalName: string;
  displayName: string;
  contactEmail: string;
  dealershipId?: string;
  createdAt: string;
};

export type ApplicationDealershipSummary = {
  id: string;
  displayName: string;
  status: string;
  dealerDealershipId?: string;
  provisionedAt?: string;
};

export type OwnerInviteStatus = {
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "CANCELLED";
  expiresAt?: string | null;
  acceptedAt?: string | null;
  lastSentAt?: string | null;
};

export type ApplicationDetail = ApplicationListItem & {
  contactPhone?: string;
  notes?: string;
  reviewNotes?: string;
  rejectionReason?: string;
  dealershipId?: string;
  dealership?: ApplicationDealershipSummary;
  ownerInviteStatus?: OwnerInviteStatus;
  updatedAt: string;
};

export type DealershipsListRes = { data: DealershipListItem[]; meta: ListMeta };
export type DealershipDetailRes = DealershipDetail;

export type DealershipListItem = {
  id: string;
  legalName: string;
  displayName: string;
  planKey: string;
  limits: unknown;
  status: string;
  dealerDealershipId?: string;
  provisionedAt?: string;
  createdAt: string;
};

export type DealershipDetail = DealershipListItem & {
  updatedAt: string;
};

export type PlatformAccountListItem = {
  id: string;
  name: string;
  email: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type AccountsListRes = { data: PlatformAccountListItem[]; meta: ListMeta };

export type SubscriptionListItem = {
  id: string;
  dealershipId: string;
  dealershipName: string;
  plan: string;
  billingStatus: string;
  billingProvider: string | null;
  currentPeriodEnd: string | null;
  createdAt: string;
};

export type SubscriptionsListRes = { data: SubscriptionListItem[]; meta: ListMeta };
