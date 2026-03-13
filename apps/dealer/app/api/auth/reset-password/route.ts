import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { validatePasswordPolicy } from "@/lib/password-policy";
import { auditLog } from "@/lib/audit";
import {
  getRequestMeta,
  handleApiError,
  readSanitizedJson,
} from "@/lib/api/handler";
import { ApiError } from "@/lib/auth";
import { RESET_PASSWORD_INVALID_CONTEXT_MESSAGE } from "@/lib/auth-password-reset";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  password: z.string().min(1, "Password is required"),
  confirmPassword: z.string().min(1, "Confirm password is required"),
});

/**
 * POST /api/auth/reset-password
 * Set new password. Requires valid session (recovery session from reset link).
 * Generic error on invalid/expired link or validation failure.
 */
export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await readSanitizedJson(request);
    } catch {
      throw new ApiError("VALIDATION_ERROR", "Invalid request body");
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError("VALIDATION_ERROR", "Validation failed", {
        fieldErrors: parsed.error.flatten().fieldErrors,
      });
    }

    const { password, confirmPassword } = parsed.data;
    if (password !== confirmPassword) {
      throw new ApiError("VALIDATION_ERROR", "Passwords do not match", {
        fieldErrors: { confirmPassword: "Passwords do not match" },
      });
    }

    const policy = validatePasswordPolicy(password);
    if (!policy.valid) {
      throw new ApiError("VALIDATION_ERROR", policy.message ?? "Invalid password", {
        fieldErrors: { password: policy.message },
      });
    }

    const supabase = await createClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      throw new ApiError("UNAUTHORIZED", RESET_PASSWORD_INVALID_CONTEXT_MESSAGE);
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      throw new ApiError("UNAUTHORIZED", RESET_PASSWORD_INVALID_CONTEXT_MESSAGE);
    }

    const meta = getRequestMeta(request);
    await auditLog({
      dealershipId: null,
      actorUserId: session.user.id,
      action: "auth.password_reset_completed",
      entity: "Auth",
      metadata: {},
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    });

    return Response.json({
      message: "Password updated. You can sign in with your new password.",
    });
  } catch (e) {
    return handleApiError(e);
  }
}
