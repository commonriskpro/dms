import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUserFromRequest } from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import {
  getRequestMeta,
  handleApiError,
  readSanitizedJson,
} from "@/lib/api/handler";
import { ApiError } from "@/lib/auth";
import { checkRateLimit, incrementRateLimit } from "@/lib/api/rate-limit";
import { sessionIdFromAccessToken } from "@/lib/sessions";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  sessionId: z.string().optional(),
  revokeAllOthers: z.boolean().optional(),
});

/**
 * POST /api/auth/sessions/revoke
 * Revoke current session (sessionId matches current) or all other sessions (revokeAllOthers).
 * Supabase does not support revoking a specific other session by id; only "all others" is supported.
 * Auth required. Rate limited.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUserFromRequest(request);

    const limitKey = `user:${user.userId}`;
    if (!checkRateLimit(limitKey, "session_revoke")) {
      throw new ApiError("RATE_LIMITED", "Too many requests. Try again later.");
    }

    let body: unknown;
    try {
      body = await readSanitizedJson(request);
    } catch {
      throw new ApiError("VALIDATION_ERROR", "Invalid request body");
    }
    const parsed = bodySchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new ApiError("VALIDATION_ERROR", "Validation failed", {
        fieldErrors: parsed.error.flatten().fieldErrors,
      });
    }

    const { sessionId, revokeAllOthers } = parsed.data;
    const supabase = await createClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      throw new ApiError("UNAUTHORIZED", "Not authenticated");
    }

    const currentId = sessionIdFromAccessToken(session.access_token);
    const meta = getRequestMeta(request);

    if (revokeAllOthers === true) {
      const { error: signOutError } = await supabase.auth.signOut({ scope: "others" });
      if (signOutError) {
        throw new ApiError("INTERNAL", "Failed to revoke sessions");
      }
      incrementRateLimit(limitKey, "session_revoke");
      await auditLog({
        dealershipId: null,
        actorUserId: user.userId,
        action: "auth.sessions_revoked_all_others",
        entity: "Auth",
        metadata: {},
        ip: meta.ip ?? null,
        userAgent: meta.userAgent ?? null,
      });
      return Response.json({ ok: true, message: "Other sessions have been revoked." });
    }

    if (sessionId !== undefined && sessionId !== null) {
      if (sessionId === currentId) {
        await supabase.auth.signOut();
        incrementRateLimit(limitKey, "session_revoke");
        await auditLog({
          dealershipId: null,
          actorUserId: user.userId,
          action: "auth.session_revoked",
          entity: "Auth",
          metadata: { sessionId: currentId },
          ip: meta.ip ?? null,
          userAgent: meta.userAgent ?? null,
        });
        return Response.json({ ok: true, message: "Session revoked." });
      }
      throw new ApiError("FORBIDDEN", "Cannot revoke that session");
    }

    throw new ApiError("VALIDATION_ERROR", "Provide sessionId or revokeAllOthers: true");
  } catch (e) {
    return handleApiError(e);
  }
}
