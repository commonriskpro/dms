import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { SUPPORT_SESSION_COOKIE, decryptSupportSessionPayload } from "@/lib/cookie";
import { jsonResponse } from "@/lib/api/handler";
import { auditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * POST /api/support-session/end
 * Clears support-session cookie. Audits impersonation.ended when a valid session was present.
 * No auth required (cookie is the auth).
 */
export async function POST(_request: NextRequest) {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SUPPORT_SESSION_COOKIE)?.value;
  if (raw) {
    const payload = decryptSupportSessionPayload(raw);
    if (payload && new Date(payload.expiresAt) > new Date()) {
      await auditLog({
        dealershipId: payload.dealershipId,
        actorUserId: null,
        action: "impersonation.ended",
        entity: "SupportSession",
        metadata: { platformUserId: payload.platformUserId },
      });
    }
  }
  cookieStore.delete(SUPPORT_SESSION_COOKIE);
  return jsonResponse({ ok: true }, 200);
}
