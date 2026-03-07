import { NextRequest } from "next/server";
import { z } from "zod";
import { createPlatformSupabaseServerClient } from "@/lib/supabase/server";
import { platformAuditLog } from "@/lib/audit";
import { handlePlatformApiError, errorResponse, jsonResponse } from "@/lib/api-handler";
import { PlatformApiError } from "@/lib/platform-auth";
import {
  checkPlatformRateLimit,
  getPlatformClientIdentifier,
  incrementPlatformRateLimit,
} from "@/lib/rate-limit";
import { getPlatformPasswordResetRedirectUrl } from "@/lib/auth-password-reset";

export const dynamic = "force-dynamic";

const SYSTEM_ACTOR_ID = "00000000-0000-0000-0000-000000000001";

const bodySchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email format"),
});

/**
 * POST /api/platform/auth/forgot-password
 * Request a password reset email. Generic success (no enumeration). Rate limited.
 */
export async function POST(request: NextRequest) {
  try {
    const clientId = getPlatformClientIdentifier(request);
    if (!checkPlatformRateLimit(clientId, "password_reset_request")) {
      return errorResponse("RATE_LIMITED", "Too many requests. Try again later.", 429);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("VALIDATION_ERROR", "Invalid request body", 422);
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Validation failed", 422, parsed.error.flatten());
    }

    const { email } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();
    const redirectTo = getPlatformPasswordResetRedirectUrl();
    const supabase = await createPlatformSupabaseServerClient();
    await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo });

    incrementPlatformRateLimit(clientId, "password_reset_request");

    await platformAuditLog({
      actorPlatformUserId: SYSTEM_ACTOR_ID,
      action: "auth.password_reset_requested",
      targetType: "auth",
    });

    return jsonResponse({
      message: "If an account exists with this email, you will receive a password reset link.",
    });
  } catch (e) {
    return handlePlatformApiError(e);
  }
}
