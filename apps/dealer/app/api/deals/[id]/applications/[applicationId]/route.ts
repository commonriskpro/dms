import { NextRequest } from "next/server";
import { z } from "zod";
import * as applicationService from "@/modules/lender-integration/service/application";
import {
  getAuthContext,
  getRequestMeta,
  guardPermission,
  handleApiError,
  jsonResponse,
  readSanitizedJson,
} from "@/lib/api/handler";
import {
  applicationIdParamSchema,
  updateApplicationBodySchema,
} from "@/modules/lender-integration/schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { errorResponse } from "@/lib/api/errors";
import { serializeFinanceApplication } from "@/modules/lender-integration/serialize";

const dealIdSchema = z.object({ id: z.string().uuid() });

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; applicationId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.read");
    const { id: dealId, applicationId } = dealIdSchema
      .merge(applicationIdParamSchema)
      .parse(await context.params);
    const app = await applicationService.getApplication(
      ctx.dealershipId,
      dealId,
      applicationId
    );
    if (!app) {
      return Response.json(
        errorResponse("NOT_FOUND", "Application not found"),
        { status: 404 }
      );
    }
    return jsonResponse({ data: serializeFinanceApplication(app) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; applicationId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.write");
    const { id: dealId, applicationId } = dealIdSchema
      .merge(applicationIdParamSchema)
      .parse(await context.params);
    const body = updateApplicationBodySchema.parse(await readSanitizedJson(request));
    const meta = getRequestMeta(request);
    const updated = await applicationService.updateApplication(
      ctx.dealershipId,
      ctx.userId,
      dealId,
      applicationId,
      { status: body.status },
      meta
    );
    if (!updated) {
      return Response.json(errorResponse("NOT_FOUND", "Application not found"), { status: 404 });
    }
    return jsonResponse({ data: serializeFinanceApplication(updated) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
