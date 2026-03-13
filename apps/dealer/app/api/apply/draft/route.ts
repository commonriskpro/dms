import { NextRequest } from "next/server";
import { getClientIdentifier } from "@/lib/api/rate-limit";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { handleApiError, jsonResponse,
  readSanitizedJson,
} from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";
import { createDraftBodySchema } from "../schemas";
import * as dealerApplicationService from "@/modules/dealer-application/service/application";

export const dynamic = "force-dynamic";

/**
 * POST /api/apply/draft — Create a new draft application (public or invite flow).
 * No auth. Rate limited per client. Returns application id and profile for resume.
 */
export async function POST(request: NextRequest) {
  const clientId = getClientIdentifier(request);
  if (!checkRateLimit(clientId, "apply")) {
    return jsonResponse(
      { error: { code: "RATE_LIMITED", message: "Too many requests" } },
      429
    );
  }
  try {
    const body = await readSanitizedJson(request);
    const parsed = createDraftBodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(validationErrorResponse(parsed.error.issues), { status: 400 });
    }
    const { source, ownerEmail, inviteId, invitedByUserId } = parsed.data;
    const app = await dealerApplicationService.createDraft(
      {
        source,
        ownerEmail,
        inviteId: inviteId ?? undefined,
        invitedByUserId: invitedByUserId ?? undefined,
      },
      { ip: request.headers.get("x-forwarded-for") ?? undefined }
    );
    return jsonResponse(
      {
        applicationId: app.id,
        status: app.status,
        source: app.source,
        ownerEmail: app.ownerEmail,
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
      },
      201
    );
  } catch (e) {
    return handleApiError(e);
  }
}
