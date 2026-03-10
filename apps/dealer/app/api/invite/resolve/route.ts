import { NextRequest } from "next/server";
import { handleApiError } from "@/lib/api/handler";
import { checkRateLimit, getClientIdentifier } from "@/lib/api/rate-limit";
import * as platformInviteService from "@/modules/platform-admin/service/invite";
import { resolveInviteQuerySchema } from "@/app/api/invite/schemas";

/** Security headers for invite routes (no sniff; do not add headers that would break the flow). */
const INVITE_HEADERS = { "X-Content-Type-Options": "nosniff" } as const;

/**
 * PUBLIC: Resolve invite by token. Returns non-PII invite details for accept page.
 * Structured error codes: INVITE_NOT_FOUND (404), INVITE_EXPIRED (410), INVITE_ALREADY_ACCEPTED (410).
 * No tokens in response or logs.
 */
export async function GET(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request);
    if (!checkRateLimit(clientId, "invite_resolve")) {
      return Response.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests" } },
        { status: 429, headers: INVITE_HEADERS }
      );
    }
    const { searchParams } = new URL(request.url);
    const { token } = resolveInviteQuerySchema.parse({
      token: searchParams.get("token"),
    });

    const data = await platformInviteService.resolveInvite(token);
    return Response.json({ data }, { status: 200, headers: INVITE_HEADERS });
  } catch (e) {
    const res = handleApiError(e);
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: new Headers({ ...Object.fromEntries(res.headers.entries()), ...INVITE_HEADERS }),
    });
  }
}
