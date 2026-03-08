import { NextRequest } from "next/server";
import { getClientIdentifier } from "@/lib/api/rate-limit";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { handleApiError, jsonResponse } from "@/lib/api/handler";
import * as dealerApplicationService from "@/modules/dealer-application/service/application";
import { z } from "zod";

const paramsSchema = z.object({ id: z.string().uuid() });

export const dynamic = "force-dynamic";

/**
 * POST /api/apply/[id]/submit — Submit application for review. No auth. Rate limited.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const clientId = getClientIdentifier(request);
  if (!checkRateLimit(clientId, "apply")) {
    return jsonResponse(
      { error: { code: "RATE_LIMITED", message: "Too many requests" } },
      429
    );
  }
  try {
    const params = paramsSchema.parse(await context.params);
    const app = await dealerApplicationService.submitApplication(
      params.id,
      { ip: request.headers.get("x-forwarded-for") ?? undefined }
    );
    return jsonResponse({
      applicationId: app.id,
      status: app.status,
      submittedAt: app.submittedAt?.toISOString() ?? null,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
