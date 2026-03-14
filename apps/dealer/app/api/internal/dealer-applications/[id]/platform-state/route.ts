import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyInternalApiJwt, InternalApiError } from "@/lib/internal-api-auth";
import { checkInternalRateLimit } from "@/lib/internal-rate-limit";
import { getOrCreateRequestId, addRequestIdToResponse } from "@/lib/request-id";
import { handleApiError, jsonResponse, readSanitizedJson } from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";
import * as dealerApplicationService from "@/modules/dealer-application/service/application";

const REQUEST_ID_HEADER = "x-request-id";
const paramsSchema = z.object({ id: z.string().uuid() });
const bodySchema = z.object({
  status: z
    .enum([
      "draft",
      "invited",
      "submitted",
      "under_review",
      "approved",
      "rejected",
      "activation_sent",
      "activated",
    ])
    .optional(),
  dealershipId: z.string().uuid().nullable().optional(),
  platformApplicationId: z.string().uuid().nullable().optional(),
  platformDealershipId: z.string().uuid().nullable().optional(),
  reviewerUserId: z.string().uuid().nullable().optional(),
  reviewNotes: z.string().nullable().optional(),
  rejectionReason: z.string().nullable().optional(),
});

function err(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const requestId = getOrCreateRequestId(request.headers.get(REQUEST_ID_HEADER));
  const rateLimitRes = await checkInternalRateLimit(request);
  if (rateLimitRes) return addRequestIdToResponse(rateLimitRes, requestId);

  try {
    await verifyInternalApiJwt(request.headers.get("authorization"));
  } catch (error) {
    if (error instanceof InternalApiError) {
      return addRequestIdToResponse(err(error.code, error.message, error.status), requestId);
    }
    throw error;
  }

  try {
    const params = paramsSchema.parse(await context.params);
    const body = await readSanitizedJson(request);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return addRequestIdToResponse(
        Response.json(validationErrorResponse(parsed.error.issues), { status: 400 }),
        requestId
      );
    }

    const updated = await dealerApplicationService.internalUpdateApplication(
      params.id,
      parsed.data,
      {
        ip: request.headers.get("x-forwarded-for") ?? undefined,
        skipPlatformSync: true,
      }
    );

    return addRequestIdToResponse(
      jsonResponse({
        id: updated.id,
        status: updated.status,
        dealershipId: updated.dealershipId ?? null,
        platformApplicationId: updated.platformApplicationId ?? null,
        platformDealershipId: updated.platformDealershipId ?? null,
        activationSentAt: updated.activationSentAt?.toISOString() ?? null,
        activatedAt: updated.activatedAt?.toISOString() ?? null,
      }),
      requestId
    );
  } catch (error) {
    const response = handleApiError(error);
    return addRequestIdToResponse(response, requestId);
  }
}
