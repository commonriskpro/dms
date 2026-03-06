import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { SUPPORT_SESSION_COOKIE } from "@/lib/cookie";
import { jsonResponse } from "@/lib/api/handler";

export const dynamic = "force-dynamic";

/**
 * POST /api/support-session/end
 * Clears support-session cookie. No auth required (cookie is the auth).
 */
export async function POST(_request: NextRequest) {
  const cookieStore = await cookies();
  cookieStore.delete(SUPPORT_SESSION_COOKIE);
  return jsonResponse({ ok: true }, 200);
}
