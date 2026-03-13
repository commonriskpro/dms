import { NextRequest } from "next/server";
import { verifyInternalApiJwt, InternalApiError } from "@/lib/internal-api-auth";
import { checkInternalRateLimit } from "@/lib/internal-rate-limit";
import { getOrCreateRequestId, addRequestIdToResponse } from "@/lib/request-id";
import { handleApiError, jsonResponse,
  readSanitizedJson,
} from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";
import * as dealerApplicationService from "@/modules/dealer-application/service/application";
import { z } from "zod";

const REQUEST_ID_HEADER = "x-request-id";

function err(code: string, msg: string, status: number) {
  return Response.json({ error: { code, message: msg } }, { status });
}

const paramsSchema = z.object({ id: z.string().uuid() });

const patchBodySchema = z.object({
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

export const dynamic = "force-dynamic";

/**
 * GET /api/internal/applications/[id] — Get full application detail (for platform review).
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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
    const params = paramsSchema.parse(await context.params);
    const app = await dealerApplicationService.getApplication(params.id);
    return addRequestIdToResponse(
      jsonResponse({
        id: app.id,
        source: app.source,
        status: app.status,
        ownerEmail: app.ownerEmail,
        inviteId: app.inviteId ?? null,
        invitedByUserId: app.invitedByUserId ?? null,
        dealershipId: app.dealershipId ?? null,
        platformApplicationId: app.platformApplicationId ?? null,
        platformDealershipId: app.platformDealershipId ?? null,
        submittedAt: app.submittedAt?.toISOString() ?? null,
        approvedAt: app.approvedAt?.toISOString() ?? null,
        rejectedAt: app.rejectedAt?.toISOString() ?? null,
        activationSentAt: app.activationSentAt?.toISOString() ?? null,
        activatedAt: app.activatedAt?.toISOString() ?? null,
        reviewerUserId: app.reviewerUserId ?? null,
        reviewNotes: app.reviewNotes ?? null,
        rejectionReason: app.rejectionReason ?? null,
        createdAt: app.createdAt.toISOString(),
        updatedAt: app.updatedAt.toISOString(),
        profile: app.profile
          ? {
              businessInfo: app.profile.businessInfo,
              ownerInfo: app.profile.ownerInfo,
              primaryContact: app.profile.primaryContact,
              additionalLocations: app.profile.additionalLocations,
              pricingPackageInterest: app.profile.pricingPackageInterest,
              acknowledgments: app.profile.acknowledgments,
            }
          : null,
      }),
      requestId
    );
  } catch (e) {
    const res = handleApiError(e);
    return addRequestIdToResponse(res, requestId);
  }
}

/**
 * PATCH /api/internal/applications/[id] — Update application (status, linkage, notes).
 * Used by platform after provision/approve and to mark activation_sent / activated.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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
    const params = paramsSchema.parse(await context.params);
    const body = await readSanitizedJson(request);
    const parsed = patchBodySchema.safeParse(body);
    if (!parsed.success) {
      return addRequestIdToResponse(
        Response.json(validationErrorResponse(parsed.error.issues), { status: 400 }),
        requestId
      );
    }
    const updated = await dealerApplicationService.internalUpdateApplication(
      params.id,
      {
        status: parsed.data.status,
        dealershipId: parsed.data.dealershipId,
        platformApplicationId: parsed.data.platformApplicationId,
        platformDealershipId: parsed.data.platformDealershipId,
        reviewerUserId: parsed.data.reviewerUserId,
        reviewNotes: parsed.data.reviewNotes,
        rejectionReason: parsed.data.rejectionReason,
      },
      { ip: request.headers.get("x-forwarded-for") ?? undefined }
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
  } catch (e) {
    const res = handleApiError(e);
    return addRequestIdToResponse(res, requestId);
  }
}
