import { NextRequest } from "next/server";
import { z } from "zod";
import { createPlatformSupabaseServerClient } from "@/lib/supabase/server";
import { platformAuditLog } from "@/lib/audit";
import { handlePlatformApiError, errorResponse, jsonResponse } from "@/lib/api-handler";
import { PlatformApiError } from "@/lib/platform-auth";
import { PLATFORM_RESET_PASSWORD_INVALID_CONTEXT_MESSAGE } from "@/lib/auth-password-reset";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  password: z.string().min(1, "Password is required"),
  confirmPassword: z.string().min(1, "Confirm password is required"),
});

function validatePasswordPolicy(password: string): { valid: boolean; message?: string } {
  if (password.length < 12) return { valid: false, message: "Password must be at least 12 characters" };
  let categories = 0;
  if (/[A-Z]/.test(password)) categories++;
  if (/[a-z]/.test(password)) categories++;
  if (/[0-9]/.test(password)) categories++;
  if (/[^A-Za-z0-9]/.test(password)) categories++;
  if (categories < 3) return { valid: false, message: "Password must include at least 3 of: uppercase, lowercase, digit, symbol" };
  return { valid: true };
}

/**
 * POST /api/platform/auth/reset-password
 * Set new password. Requires valid session (recovery from reset link). Generic error on invalid/expired.
 */
export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new PlatformApiError("VALIDATION_ERROR", "Invalid request body", 422);
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      throw new PlatformApiError("VALIDATION_ERROR", "Validation failed", 422);
    }
    const { password, confirmPassword } = parsed.data;
    if (password !== confirmPassword) {
      throw new PlatformApiError("VALIDATION_ERROR", "Passwords do not match", 422);
    }
    const policy = validatePasswordPolicy(password);
    if (!policy.valid) {
      throw new PlatformApiError("VALIDATION_ERROR", policy.message ?? "Invalid password", 422);
    }

    const supabase = await createPlatformSupabaseServerClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      throw new PlatformApiError("UNAUTHORIZED", PLATFORM_RESET_PASSWORD_INVALID_CONTEXT_MESSAGE, 401);
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      throw new PlatformApiError("UNAUTHORIZED", PLATFORM_RESET_PASSWORD_INVALID_CONTEXT_MESSAGE, 401);
    }

    await platformAuditLog({
      actorPlatformUserId: session.user.id,
      action: "auth.password_reset_completed",
      targetType: "auth",
    });

    return jsonResponse({
      message: "Password updated. You can sign in with your new password.",
    });
  } catch (e) {
    return handlePlatformApiError(e);
  }
}
