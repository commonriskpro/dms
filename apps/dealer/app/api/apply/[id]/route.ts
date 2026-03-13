import { NextRequest } from "next/server";
import { getClientIdentifier } from "@/lib/api/rate-limit";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { handleApiError, jsonResponse,
  readSanitizedJson,
} from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";
import { updateDraftBodySchema } from "../schemas";
import * as dealerApplicationService from "@/modules/dealer-application/service/application";
import { z } from "zod";

const paramsSchema = z.object({ id: z.string().uuid() });

export const dynamic = "force-dynamic";

/**
 * GET /api/apply/[id] — Load application by id (for resume). No auth. Rate limited.
 * Returns 404 if not found or not in draft/invited state (for edit); still returns read-only if submitted.
 */
export async function GET(
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
    const app = await dealerApplicationService.getApplication(params.id);
    return jsonResponse({
      applicationId: app.id,
      status: app.status,
      source: app.source,
      ownerEmail: app.ownerEmail,
      submittedAt: app.submittedAt?.toISOString() ?? null,
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
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/**
 * PATCH /api/apply/[id] — Update draft profile. No auth. Rate limited.
 * Only allowed when status is draft or invited.
 */
export async function PATCH(
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
    const body = await readSanitizedJson(request);
    const parsed = updateDraftBodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(validationErrorResponse(parsed.error.issues), { status: 400 });
    }
    const app = await dealerApplicationService.updateDraft(
      params.id,
      parsed.data,
      { ip: request.headers.get("x-forwarded-for") ?? undefined }
    );
    return jsonResponse({
      applicationId: app.id,
      status: app.status,
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
    });
  } catch (e) {
    return handleApiError(e);
  }
}
