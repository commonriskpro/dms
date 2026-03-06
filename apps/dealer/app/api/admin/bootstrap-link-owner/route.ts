import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { setActiveDealershipCookie } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { handleApiError, jsonResponse } from "@/lib/api/handler";
import { ApiError } from "@/lib/auth";
import { getOrCreateProfile } from "@/lib/auth";

/**
 * Links the current authenticated user as Owner of the first (demo) dealership.
 * Only allowed when that dealership has no members (initial bootstrap) or ALLOW_BOOTSTRAP_LINK=1.
 * Creates Profile if missing (using Supabase user email).
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const allowBootstrap = process.env.ALLOW_BOOTSTRAP_LINK === "1";
    const dealership = await prisma.dealership.findFirst({
      where: { slug: "demo" },
      orderBy: { createdAt: "asc" },
    });
    if (!dealership) {
      throw new ApiError("NOT_FOUND", "No demo dealership found. Run db:seed first.");
    }
    const memberCount = await prisma.membership.count({
      where: { dealershipId: dealership.id, disabledAt: null },
    });
    if (memberCount > 0 && !allowBootstrap) {
      throw new ApiError("FORBIDDEN", "Dealership already has members. Set ALLOW_BOOTSTRAP_LINK=1 to link anyway.");
    }
    const ownerRole = await prisma.role.findFirst({
      where: { dealershipId: dealership.id, name: "Owner", deletedAt: null },
    });
    if (!ownerRole) {
      throw new ApiError("NOT_FOUND", "Owner role not found. Run db:seed first.");
    }
    await getOrCreateProfile(user.userId, { email: user.email });
    const existing = await prisma.membership.findFirst({
      where: { userId: user.userId, dealershipId: dealership.id, disabledAt: null },
    });
    if (existing) {
      return jsonResponse({
        message: "Already linked",
        membershipId: existing.id,
        dealershipId: dealership.id,
      });
    }
    const membership = await prisma.membership.create({
      data: {
        dealershipId: dealership.id,
        userId: user.userId,
        roleId: ownerRole.id,
        joinedAt: new Date(),
      },
    });
    await setActiveDealershipCookie(dealership.id);
    return jsonResponse({
      message: "Linked as Owner",
      membershipId: membership.id,
      dealershipId: dealership.id,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
