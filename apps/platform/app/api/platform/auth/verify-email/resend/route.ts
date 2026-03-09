import { NextRequest } from "next/server";
import { createPlatformSupabaseServerClient } from "@/lib/supabase/server";
import { platformAuditLog } from "@/lib/audit";
import { handlePlatformApiError, errorResponse, jsonResponse } from "@/lib/api-handler";
import { PlatformApiError } from "@/lib/platform-auth";
import {
  checkPlatformRateLimit,
  getPlatformClientIdentifier,
  incrementPlatformRateLimit,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/platform/auth/verify-email/resend
 * Resend verification email for the current user. Auth required. Rate limited.
 */
export async function POST(request: NextRequest) {
  try {
    const { requirePlatformAuth } = await import("@/lib/platform-auth");
    const user = await requirePlatformAuth();

    const clientId = getPlatformClientIdentifier(request);
    if (!checkPlatformRateLimit(clientId, "email_verification_resend")) {
      throw new PlatformApiError("RATE_LIMITED", "Too many requests. Try again later.", 429);
    }

    const supabase = await createPlatformSupabaseServerClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser?.email) {
      throw new PlatformApiError("UNAUTHORIZED", "Not authenticated", 401);
    }

    await supabase.auth.resend({
      type: "signup",
      email: authUser.email,
    });

    incrementPlatformRateLimit(clientId, "email_verification_resend");

    await platformAuditLog({
      actorPlatformUserId: user.userId,
      action: "auth.email_verification_resent",
      targetType: "auth",
    });

    return jsonResponse({
      message: "If your email is not yet verified, you will receive a verification link.",
    });
  } catch (e) {
    return handlePlatformApiError(e);
  }
}
