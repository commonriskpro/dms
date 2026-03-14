import { NextRequest } from "next/server";
import { requireUserFromRequest } from "@/lib/auth";
import { handleApiError, jsonResponse, getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
import { checkRateLimit, getClientIdentifier } from "@/lib/api/rate-limit";
import { meCurrentDealershipPostBodySchema } from "@/lib/types/me";
import * as sessionService from "@/modules/core-platform/service/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/me/current-dealership — Current active dealership and membership metadata, or null.
 * Supports Bearer or cookie. Does not require an active dealership (so multi-dealership user can call before selecting).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUserFromRequest(request);
    const result = await sessionService.getCurrentDealershipSummary(user.userId, request);
    return jsonResponse(result);
  } catch (e) {
    return handleApiError(e);
  }
}

/**
 * POST /api/me/current-dealership — Set active dealership (switch). Validates membership, persists, sets cookie, audits.
 * Supports Bearer (mobile) or cookie.
 */
export async function POST(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request);
    if (!checkRateLimit(clientId, "session_switch")) {
      return Response.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests" } },
        { status: 429 }
      );
    }
    const user = await requireUserFromRequest(request);
    const body = await readSanitizedJson(request).catch(() => ({}));
    const { dealershipId } = meCurrentDealershipPostBodySchema.parse(body);
    const result = await sessionService.switchActiveDealership({
      userId: user.userId,
      email: user.email,
      dealershipId,
      meta: getRequestMeta(request),
    });

    return jsonResponse({
      data: {
        dealershipId: result.dealership.id,
        dealershipName: result.dealership.name,
        roleKey: result.role?.key ?? null,
        roleName: result.role?.name ?? "—",
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
