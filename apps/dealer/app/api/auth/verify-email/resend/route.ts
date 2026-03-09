import { NextRequest } from "next/server";
import { requireUserFromRequest } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import {
  getRequestMeta,
  handleApiError,
} from "@/lib/api/handler";
import { ApiError } from "@/lib/auth";
import {
  checkRateLimit,
  getClientIdentifier,
  incrementRateLimit,
} from "@/lib/api/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/verify-email/resend
 * Resend verification email for the current user. Auth required. Rate limited.
 * Generic success message (no enumeration).
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUserFromRequest(request);

    const clientId = getClientIdentifier(request);
    if (!checkRateLimit(clientId, "email_verification_resend")) {
      throw new ApiError("RATE_LIMITED", "Too many requests. Try again later.");
    }
    const userLimitKey = `user:${user.userId}`;
    if (!checkRateLimit(userLimitKey, "email_verification_resend_per_user")) {
      throw new ApiError("RATE_LIMITED", "Too many requests. Try again later.");
    }

    const supabase = await createClient();
    await supabase.auth.resend({
      type: "signup",
      email: user.email,
    });

    incrementRateLimit(clientId, "email_verification_resend");
    incrementRateLimit(userLimitKey, "email_verification_resend_per_user");

    const meta = getRequestMeta(request);
    await auditLog({
      dealershipId: null,
      actorUserId: user.userId,
      action: "auth.email_verification_resent",
      entity: "Auth",
      metadata: {},
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    });

    return Response.json({
      message: "If your email is not yet verified, you will receive a verification link.",
    });
  } catch (e) {
    return handleApiError(e);
  }
}
