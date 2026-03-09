import { NextRequest } from "next/server";
import { verifyInternalApiJwt, InternalApiError } from "@/lib/internal-api-auth";
import { checkInternalRateLimit } from "@/lib/internal-rate-limit";
import { getOrCreateRequestId, addRequestIdToResponse } from "@/lib/request-id";
import { handleApiError, jsonResponse } from "@/lib/api/handler";
import * as dealerApplicationService from "@/modules/dealer-application/service/application";
import { z } from "zod";

const REQUEST_ID_HEADER = "x-request-id";

function err(code: string, msg: string, status: number) {
  return Response.json({ error: { code, message: msg } }, { status });
}

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
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
  source: z.enum(["invite", "public_apply"]).optional(),
});

export const dynamic = "force-dynamic";

/**
 * GET /api/internal/applications — List dealer applications (for platform review).
 * Requires internal API JWT. Query: limit, offset, status, source.
 */
export async function GET(request: NextRequest) {
  const requestId = getOrCreateRequestId(request.headers.get(REQUEST_ID_HEADER));
  const rateLimitRes = await checkInternalRateLimit(request);
  if (rateLimitRes) return addRequestIdToResponse(rateLimitRes, requestId);
  try {
    await verifyInternalApiJwt(request.headers.get("authorization"));
  } catch (e) {
    if (e instanceof InternalApiError) {
      return addRequestIdToResponse(err(e.code, e.message, e.status), requestId);
    }
    throw e;
  }
  try {
    const { searchParams } = new URL(request.url);
    const parsed = listQuerySchema.safeParse({
      limit: searchParams.get("limit"),
      offset: searchParams.get("offset"),
      status: searchParams.get("status") ?? undefined,
      source: searchParams.get("source") ?? undefined,
    });
    if (!parsed.success) {
      return addRequestIdToResponse(
        Response.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Validation failed",
              details: parsed.error.flatten(),
            },
          },
          { status: 400 }
        ),
        requestId
      );
    }
    const { limit = 25, offset = 0, status, source } = parsed.data;
    const result = await dealerApplicationService.listApplications({
      limit,
      offset,
      status: status as "draft" | "invited" | "submitted" | "under_review" | "approved" | "rejected" | "activation_sent" | "activated" | undefined,
      source: source as "invite" | "public_apply" | undefined,
    });
    return addRequestIdToResponse(
      jsonResponse({
        data: result.data.map((a) => ({
          id: a.id,
          source: a.source,
          status: a.status,
          ownerEmail: a.ownerEmail,
          submittedAt: a.submittedAt?.toISOString() ?? null,
          approvedAt: a.approvedAt?.toISOString() ?? null,
          rejectedAt: a.rejectedAt?.toISOString() ?? null,
          dealershipId: a.dealershipId ?? null,
          platformApplicationId: a.platformApplicationId ?? null,
          platformDealershipId: a.platformDealershipId ?? null,
          createdAt: a.createdAt.toISOString(),
        })),
        meta: { total: result.total, limit, offset },
      }),
      requestId
    );
  } catch (e) {
    const res = handleApiError(e);
    return addRequestIdToResponse(res, requestId);
  }
}
