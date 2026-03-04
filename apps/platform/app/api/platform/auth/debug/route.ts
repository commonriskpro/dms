import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPlatformAuthDebug } from "@/lib/env";
import { getPlatformUserIdFromRequest, getPlatformUserOrNull } from "@/lib/platform-auth";

/**
 * DEV-ONLY: GET /api/platform/auth/debug
 * Returns cookie names, supabaseHasUser, userIdTail, platformUserFound.
 * When PLATFORM_AUTH_DEBUG is not set, returns 404.
 * No auth required so it can be called right after login to verify server sees session.
 */
export async function GET() {
  if (!getPlatformAuthDebug()) {
    return new NextResponse(null, { status: 404 });
  }
  const cookieStore = await cookies();
  const cookieNames = cookieStore.getAll().map((c) => c.name);
  const userId = await getPlatformUserIdFromRequest();
  const supabaseHasUser = !!userId;
  const userIdTail = userId && userId.length >= 6 ? userId.slice(-6) : null;
  const result = await getPlatformUserOrNull();
  const platformUserFound =
    result !== null && typeof result === "object" && !("forbidden" in result);

  return NextResponse.json({
    cookieNames,
    supabaseHasUser,
    userIdTail,
    platformUserFound,
  });
}
