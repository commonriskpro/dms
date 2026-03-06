/**
 * Platform user invite-by-email service. Uses Supabase Admin API (server-side only).
 * Caller must enforce PLATFORM_OWNER. Audit uses recipientHash only (no email).
 */

import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { platformAuditLog } from "@/lib/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { upsertPlatformUser } from "@/lib/platform-users-service";
import type { PlatformAuthUser } from "@/lib/platform-auth";
import type { PlatformInviteUserResponse } from "@dms/contracts";

const DEDUPE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_ROLE = "PLATFORM_SUPPORT" as const;
const PLATFORM_ROLE_VALUES = ["PLATFORM_OWNER", "PLATFORM_COMPLIANCE", "PLATFORM_SUPPORT"] as const;
type PlatformRole = (typeof PLATFORM_ROLE_VALUES)[number];

function recipientHash(normalizedEmail: string): string {
  return createHash("sha256").update(normalizedEmail, "utf8").digest("hex");
}

/**
 * Find Supabase auth user by email via admin listUsers (paginated).
 * Returns user id if found, null otherwise.
 */
async function findSupabaseUserByEmail(email: string): Promise<{ id: string } | null> {
  const admin = createSupabaseAdminClient();
  const maxPages = 10;
  const perPage = 50;
  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) return null;
    const users = data?.users ?? [];
    const match = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match?.id) return { id: match.id };
    if (users.length < perPage) break;
  }
  return null;
}

/**
 * Invite a platform user by email. OWNER-only; caller must enforce.
 * - If user already exists in Supabase: upsert platform_users, do not send invite.
 * - If not: check 5-min cooldown by recipientHash; if recent, return alreadySentRecently.
 * - Otherwise: invite via Supabase admin, upsert platform_users, log cooldown, audit.
 */
export async function invitePlatformUserByEmail(
  actor: PlatformAuthUser,
  normalizedEmail: string,
  role: string,
  options?: { requestId?: string | null }
): Promise<PlatformInviteUserResponse> {
  const resolvedRole: PlatformRole = PLATFORM_ROLE_VALUES.includes(role as PlatformRole)
    ? (role as PlatformRole)
    : DEFAULT_ROLE;
  const hash = recipientHash(normalizedEmail);
  const requestId = options?.requestId ?? undefined;

  const existingSupabaseUser = await findSupabaseUserByEmail(normalizedEmail);
  if (existingSupabaseUser) {
    await upsertPlatformUser(actor, { id: existingSupabaseUser.id, role: resolvedRole }, { requestId: requestId ?? null });
    await platformAuditLog({
      actorPlatformUserId: actor.userId,
      action: "platform.user_invited",
      targetType: "platform_user",
      targetId: existingSupabaseUser.id,
      afterState: { recipientHash: hash },
      requestId,
    });
    return {
      ok: true,
      invited: false,
      userId: existingSupabaseUser.id,
      role: resolvedRole,
    };
  }

  const fiveMinutesAgo = new Date(Date.now() - DEDUPE_WINDOW_MS);
  const recentLog = await prisma.platformInviteLog.findFirst({
    where: { recipientHash: hash, sentAt: { gte: fiveMinutesAgo } },
    orderBy: { sentAt: "desc" },
  });
  if (recentLog) {
    await platformAuditLog({
      actorPlatformUserId: actor.userId,
      action: "platform.user_invite_skipped_recent",
      targetType: "platform_user",
      afterState: { recipientHash: hash },
      requestId,
    });
    return {
      ok: true,
      invited: false,
      role: resolvedRole,
      alreadySentRecently: true,
    };
  }

  const admin = createSupabaseAdminClient();
  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(normalizedEmail, {
    redirectTo: undefined,
  });

  if (inviteError) {
    throw new Error(`Supabase invite failed: ${inviteError.message}`);
  }

  const userId = inviteData?.user?.id ?? null;
  if (userId) {
    await upsertPlatformUser(actor, { id: userId, role: resolvedRole }, { requestId: requestId ?? null });
  }

  await prisma.platformInviteLog.create({
    data: { recipientHash: hash, sentAt: new Date() },
  });

  await platformAuditLog({
    actorPlatformUserId: actor.userId,
    action: "platform.user_invited",
    targetType: "platform_user",
    targetId: userId ?? undefined,
    afterState: { recipientHash: hash },
    requestId,
  });

  return {
    ok: true,
    invited: true,
    ...(userId && { userId }),
    role: resolvedRole,
  };
}
