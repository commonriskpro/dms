import { NextRequest } from "next/server";
import { createPlatformSupabaseServerClient } from "@/lib/supabase/server";
import { requirePlatformAuth } from "@/lib/platform-auth";
import { handlePlatformApiError, errorResponse, jsonResponse } from "@/lib/api-handler";
import { platformSessionIdFromAccessToken, type PlatformSessionItem } from "@/lib/sessions";

export const dynamic = "force-dynamic";

/**
 * GET /api/platform/auth/sessions
 * Returns current session only (Supabase does not expose multi-session list). Auth required.
 */
export async function GET(request: NextRequest) {
  try {
    await requirePlatformAuth();

    const supabase = await createPlatformSupabaseServerClient();
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session) {
      return errorResponse("UNAUTHORIZED", "Not authenticated", 401);
    }

    const now = new Date().toISOString();
    const item: PlatformSessionItem = {
      id: platformSessionIdFromAccessToken(session.access_token),
      current: true,
      createdAt: now,
      lastActiveAt: now,
    };

    return jsonResponse({ sessions: [item] });
  } catch (e) {
    return handlePlatformApiError(e);
  }
}
