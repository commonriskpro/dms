import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUserFromRequest } from "@/lib/auth";
import { handleApiError, jsonResponse, getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
import { checkRateLimit, getClientIdentifier } from "@/lib/api/rate-limit";
import * as sessionService from "@/modules/core-platform/service/session";

const bodySchema = z.object({ dealershipId: z.string().uuid() });

export async function PATCH(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request);
    if (!checkRateLimit(clientId, "session_switch")) {
      return Response.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests" } },
        { status: 429 }
      );
    }
    const user = await requireUserFromRequest(request);
    const body = await readSanitizedJson(request);
    const { dealershipId } = bodySchema.parse(body);
    const result = await sessionService.switchActiveDealership({
      userId: user.userId,
      email: user.email,
      dealershipId,
      meta: getRequestMeta(request),
      includeSessionEnvelope: true,
    });

    return jsonResponse({
      user: result.user ?? { id: user.userId, email: user.email },
      activeDealership: result.dealership,
      permissions: result.permissions ?? [],
    });
  } catch (e) {
    return handleApiError(e);
  }
}
