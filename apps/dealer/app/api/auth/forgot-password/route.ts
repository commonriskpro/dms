import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import { getRequestMeta, handleApiError,
  readSanitizedJson,
} from "@/lib/api/handler";
import {
  checkRateLimit,
  getClientIdentifier,
  checkRateLimitPasswordResetByEmail,
  incrementRateLimitPasswordResetByEmail,
  incrementRateLimit,
} from "@/lib/api/rate-limit";
import { getPasswordResetRedirectUrl } from "@/lib/auth-password-reset";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email format"),
});

/**
 * POST /api/auth/forgot-password
 * Request a password reset email. Always returns generic success (no email enumeration).
 * Rate limited per IP and per email (hashed bucket).
 */
export async function POST(request: NextRequest) {
  const clientId = getClientIdentifier(request);
  if (!checkRateLimit(clientId, "password_reset_request")) {
    return Response.json(
      { error: { code: "RATE_LIMITED", message: "Too many requests. Try again later." } },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await readSanitizedJson(request);
  } catch {
    return Response.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid request body" } },
      { status: 422 }
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: { fieldErrors: parsed.error.flatten().fieldErrors },
        },
      },
      { status: 422 }
    );
  }

  const { email } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  if (!checkRateLimitPasswordResetByEmail(normalizedEmail)) {
    return Response.json(
      { error: { code: "RATE_LIMITED", message: "Too many requests. Try again later." } },
      { status: 429 }
    );
  }

  try {
    const redirectTo = getPasswordResetRedirectUrl();
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo });

    incrementRateLimit(clientId, "password_reset_request");
    incrementRateLimitPasswordResetByEmail(normalizedEmail);

    const meta = getRequestMeta(request);
    await auditLog({
      dealershipId: null,
      actorUserId: null,
      action: "auth.password_reset_requested",
      entity: "Auth",
      metadata: {},
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    });

    return Response.json({
      message: "If an account exists with this email, you will receive a password reset link.",
    });
  } catch (e) {
    return handleApiError(e);
  }
}
