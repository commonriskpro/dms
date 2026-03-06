/**
 * Short-lived in-memory cache for dealer owner-invite-status to avoid spamming dealer on refresh.
 * Key: ownerInviteStatus:${dealerDealershipId}:${contactEmailHash}
 * TTL: 15 seconds. Best-effort; serverless may not persist across invocations.
 * Stores only status + timestamps (no email, no token).
 */

const TTL_MS = 15_000;

type CachedEntry = {
  status: string;
  expiresAt: string | null;
  acceptedAt: string | null;
  invitedAt?: string;
  cachedAt: number;
};

const cache = new Map<string, CachedEntry>();

function isExpired(entry: CachedEntry): boolean {
  return Date.now() - entry.cachedAt >= TTL_MS;
}

export function getOwnerInviteStatusCached(
  dealerDealershipId: string,
  contactEmailHash: string
): { status: string; expiresAt: string | null; acceptedAt: string | null; invitedAt?: string } | null {
  const key = `ownerInviteStatus:${dealerDealershipId}:${contactEmailHash}`;
  const entry = cache.get(key);
  if (!entry || isExpired(entry)) {
    if (entry) cache.delete(key);
    return null;
  }
  return {
    status: entry.status,
    expiresAt: entry.expiresAt,
    acceptedAt: entry.acceptedAt,
    ...(entry.invitedAt && { invitedAt: entry.invitedAt }),
  };
}

export function setOwnerInviteStatusCached(
  dealerDealershipId: string,
  contactEmailHash: string,
  data: { status: string; expiresAt: string | null; acceptedAt: string | null; invitedAt?: string }
): void {
  const key = `ownerInviteStatus:${dealerDealershipId}:${contactEmailHash}`;
  cache.set(key, {
    status: data.status,
    expiresAt: data.expiresAt,
    acceptedAt: data.acceptedAt,
    invitedAt: data.invitedAt,
    cachedAt: Date.now(),
  });
}
