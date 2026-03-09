import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUserFromRequest } from "@/lib/auth";
import { handleApiError } from "@/lib/api/handler";
import { sessionIdFromAccessToken, type SessionItem } from "@/lib/sessions";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/sessions
 * Returns list of sessions for the current user. Supabase does not expose multi-session list;
 * we return the current session only (single item). Auth required.
 */
export async function GET(request: NextRequest) {
  try {
    await requireUserFromRequest(request);

    const supabase = await createClient();
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const now = new Date().toISOString();
    const item: SessionItem = {
      id: sessionIdFromAccessToken(session.access_token),
      current: true,
      createdAt: now,
      lastActiveAt: now,
    };

    return Response.json({ sessions: [item] });
  } catch (e) {
    return handleApiError(e);
  }
}
