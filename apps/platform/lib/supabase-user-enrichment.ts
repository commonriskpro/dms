/**
 * Supabase Auth user enrichment for platform users (display-only).
 * Uses Admin API; failures are graceful (return null for that user).
 * Server-only.
 */

export type SupabaseUserEnrichment = {
  email: string | null;
  displayName: string | null;
  lastSignInAt: string | null;
};

const EMPTY: SupabaseUserEnrichment = {
  email: null,
  displayName: null,
  lastSignInAt: null,
};

/**
 * Fetch display-only enrichment for one Supabase user by id.
 * Returns null fields on any error (user not found, network, etc.); never throws.
 */
export async function getSupabaseUserEnrichment(
  userId: string
): Promise<SupabaseUserEnrichment> {
  try {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data?.user) return EMPTY;
    const u = data.user;
    const email =
      typeof u.email === "string" && u.email.trim() ? u.email.trim() : null;
    const meta = u.user_metadata as Record<string, unknown> | undefined;
    const displayName =
      meta && typeof meta.full_name === "string" && meta.full_name.trim()
        ? (meta.full_name as string).trim()
        : null;
    const lastSignInAt =
      u.last_sign_in_at != null
        ? new Date(u.last_sign_in_at).toISOString()
        : null;
    return { email, displayName, lastSignInAt };
  } catch {
    return EMPTY;
  }
}

/**
 * Enrich multiple user ids. Returns a Map; missing or failed lookups have null-ish values.
 * Limits concurrency to avoid thundering herd (max 10 in flight).
 */
const CONCURRENCY = 10;

export async function getSupabaseUsersEnrichment(
  userIds: string[]
): Promise<Map<string, SupabaseUserEnrichment>> {
  const map = new Map<string, SupabaseUserEnrichment>();
  const queue = [...userIds];
  const inFlight: Promise<void>[] = [];

  async function runOne(id: string): Promise<void> {
    const enrichment = await getSupabaseUserEnrichment(id);
    map.set(id, enrichment);
  }

  while (queue.length > 0 || inFlight.length > 0) {
    while (inFlight.length < CONCURRENCY && queue.length > 0) {
      const id = queue.shift()!;
      const p = runOne(id).then(() => {
        inFlight.splice(inFlight.indexOf(p), 1);
      });
      inFlight.push(p);
    }
    if (inFlight.length > 0) {
      await Promise.race(inFlight);
    }
  }
  return map;
}
