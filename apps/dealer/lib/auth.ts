import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";

export type CurrentUser = { userId: string; email: string };

/**
 * Returns current user from Supabase session (server-side cookies).
 * Returns null if no session or session invalid.
 */
export async function getCurrentUser(): Promise<{ userId: string; email?: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return {
    userId: user.id,
    email: user.email ?? undefined,
  };
}

/**
 * Returns current user or throws with UNAUTHORIZED error shape.
 * Returns profile.id as userId so memberships and permissions resolve correctly
 * (same identity after getOrCreateProfile by email).
 */
export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u || !u.userId) {
    throw new ApiError("UNAUTHORIZED", "Not authenticated");
  }
  const profile = await getOrCreateProfile(u.userId, { email: u.email ?? undefined });
  return { userId: profile.id, email: profile.email };
}

/**
 * Ensures a Profile row exists for the given Supabase user id.
 * Creates one with email (and optional props) if missing.
 * Use after login or when first linking a user to a dealership.
 */
export async function getOrCreateProfile(
  userId: string,
  props?: { email?: string; fullName?: string | null; avatarUrl?: string | null }
): Promise<{ id: string; email: string; fullName: string | null; avatarUrl: string | null }> {
  const existing = await prisma.profile.findUnique({ where: { id: userId } });
  if (existing) {
    const membershipCount = await prisma.membership.count({
      where: { userId: existing.id, disabledAt: null },
    });
    if (membershipCount > 0) {
      await prisma.pendingApproval.deleteMany({ where: { userId: existing.id } });
    }
    if (props && (props.email !== undefined || props.fullName !== undefined || props.avatarUrl !== undefined)) {
      const updated = await prisma.profile.update({
        where: { id: userId },
        data: {
          ...(props.email !== undefined && { email: props.email }),
          ...(props.fullName !== undefined && { fullName: props.fullName }),
          ...(props.avatarUrl !== undefined && { avatarUrl: props.avatarUrl }),
        },
      });
      return { id: updated.id, email: updated.email, fullName: updated.fullName, avatarUrl: updated.avatarUrl };
    }
    return { id: existing.id, email: existing.email, fullName: existing.fullName, avatarUrl: existing.avatarUrl };
  }
  const email = props?.email ?? "";
  if (!email) throw new Error("Email required to create profile");
  const created = await prisma.profile.create({
    data: {
      id: userId,
      email,
      fullName: props?.fullName ?? null,
      avatarUrl: props?.avatarUrl ?? null,
    },
  });
  await prisma.pendingApproval.upsert({
    where: { userId: created.id },
    create: { userId: created.id, email: created.email },
    update: { email: created.email, updatedAt: new Date() },
  });
  return { id: created.id, email: created.email, fullName: created.fullName, avatarUrl: created.avatarUrl };
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
  }
}
