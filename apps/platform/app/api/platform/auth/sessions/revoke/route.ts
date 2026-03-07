import { NextRequest } from "next/server";
import { z } from "zod";
import { createPlatformSupabaseServerClient } from "@/lib/supabase/server";
import { platformAuditLog } from "@/lib/audit";
import { handlePlatformApiError, jsonResponse } from "@/lib/api-handler";
import { PlatformApiError, requirePlatformAuth } from "@/lib/platform-auth";
import {
  checkPlatformRateLimit,
  incrementPlatformRateLimit,
} from "@/lib/rate-limit";
import { platformSessionIdFromAccessToken } from "@/lib/sessions";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  sessionId: z.string().optional(),
  revokeAllOthers: z.boolean().optional(),
});

/**
 * POST /api/platform/auth/sessions/revoke
 * Revoke current session or all other sessions. Auth required. Rate limited.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requirePlatformAuth();

    const limitKey = `user:${user.userId}`;
    if (!checkPlatformRateLimit(limitKey, "session_revoke")) {
      throw new PlatformApiError("RATE_LIMITED", "Too many requests. Try again later.", 429);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new PlatformApiError("VALIDATION_ERROR", "Invalid request body", 422);
    }
    const parsed = bodySchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new PlatformApiError("VALIDATION_ERROR", "Validation failed", 422);
    }

    const { sessionId, revokeAllOthers } = parsed.data;
    const supabase = await createPlatformSupabaseServerClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      throw new PlatformApiError("UNAUTHORIZED", "Not authenticated", 401);
    }

    const currentId = platformSessionIdFromAccessToken(session.access_token);

    if (revokeAllOthers === true) {
      const { error: signOutError } = await supabase.auth.signOut({ scope: "others" });
      if (signOutError) {
        throw new PlatformApiError("INTERNAL_ERROR", "Failed to revoke sessions", 500);
      }
      incrementPlatformRateLimit(limitKey, "session_revoke");
      await platformAuditLog({
        actorPlatformUserId: user.userId,
        action: "auth.sessions_revoked_all_others",
        targetType: "auth",
      });
      return jsonResponse({ ok: true, message: "Other sessions have been revoked." });
    }

    if (sessionId !== undefined && sessionId !== null) {
      if (sessionId === currentId) {
        await supabase.auth.signOut();
        incrementPlatformRateLimit(limitKey, "session_revoke");
        await platformAuditLog({
          actorPlatformUserId: user.userId,
          action: "auth.session_revoked",
          targetType: "auth",
        });
        return jsonResponse({ ok: true, message: "Session revoked." });
      }
      throw new PlatformApiError("FORBIDDEN", "Cannot revoke that session", 403);
    }

    throw new PlatformApiError("VALIDATION_ERROR", "Provide sessionId or revokeAllOthers: true", 422);
  } catch (e) {
    return handlePlatformApiError(e);
  }
}
