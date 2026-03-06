import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { verifySupportSessionToken } from "@/lib/support-session-verify";
import {
  SUPPORT_SESSION_COOKIE,
  SUPPORT_SESSION_MAX_AGE,
  encryptSupportSessionPayload,
} from "@/lib/cookie";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/support-session/consume?token=...
 * Verifies platform-issued support-session JWT, sets cookie, redirects to /.
 * Invalid/expired token: 400 and no cookie set.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token?.trim()) {
    return new Response("Missing token", { status: 400 });
  }

  try {
    const payload = await verifySupportSessionToken(token.trim());
    const expiresAt = new Date(Date.now() + SUPPORT_SESSION_MAX_AGE * 1000);
    const dealership = await prisma.dealership.findUnique({
      where: { id: payload.dealershipId },
      select: { id: true, lifecycleStatus: true },
    });
    if (!dealership || dealership.lifecycleStatus === "CLOSED") {
      return new Response("Dealership not found or closed", { status: 403 });
    }

    const cookieStore = await cookies();
    const value = encryptSupportSessionPayload({
      dealershipId: payload.dealershipId,
      platformUserId: payload.platformUserId,
      expiresAt: expiresAt.toISOString(),
    });
    const isProd = process.env.NODE_ENV === "production";
    cookieStore.set(SUPPORT_SESSION_COOKIE, value, {
      httpOnly: true,
      secure: isProd,
      sameSite: "strict",
      maxAge: SUPPORT_SESSION_MAX_AGE,
      path: "/",
    });

    const base = request.nextUrl.origin;
    return Response.redirect(`${base}/`, 302);
  } catch {
    return new Response("Invalid or expired token", { status: 401 });
  }
}
