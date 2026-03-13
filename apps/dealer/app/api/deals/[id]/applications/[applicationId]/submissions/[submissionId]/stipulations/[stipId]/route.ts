import { NextRequest } from "next/server";
import { z } from "zod";
import * as stipulationService from "@/modules/lender-integration/service/stipulation";
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
  submissionIdParamSchema,
  stipIdParamSchema,
  updateStipulationBodySchema,
} from "@/modules/lender-integration/schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { errorResponse } from "@/lib/api/errors";
import { serializeStipulation } from "@/modules/lender-integration/serialize";

const dealIdSchema = z.object({ id: z.string().uuid() });

export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{
      id: string;
      applicationId: string;
      submissionId: string;
      stipId: string;
    }>;
  }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.write");
    const { submissionId, stipId } = dealIdSchema
      .merge(applicationIdParamSchema)
      .merge(submissionIdParamSchema)
      .merge(stipIdParamSchema)
      .parse(await context.params);
    const body = updateStipulationBodySchema.parse(await readSanitizedJson(request));
    const meta = getRequestMeta(request);
    const data: Record<string, unknown> = {};
    if (body.stipType !== undefined) data.stipType = body.stipType;
    if (body.status !== undefined) data.status = body.status;
    if (body.requestedAt !== undefined) data.requestedAt = body.requestedAt;
    if (body.receivedAt !== undefined) data.receivedAt = body.receivedAt;
    if (body.documentId !== undefined) data.documentId = body.documentId;
    if (body.notes !== undefined) data.notes = body.notes;
    const updated = await stipulationService.updateStipulation(
      ctx.dealershipId,
      ctx.userId,
      submissionId,
      stipId,
      data as Parameters<typeof stipulationService.updateStipulation>[4],
      meta
    );
    if (!updated) {
      return Response.json(errorResponse("NOT_FOUND", "Stipulation not found"), { status: 404 });
    }
    return jsonResponse({ data: serializeStipulation(updated) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function DELETE(
  request: NextRequest,
  context: {
    params: Promise<{
      id: string;
      applicationId: string;
      submissionId: string;
      stipId: string;
    }>;
  }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.write");
    const { submissionId, stipId } = dealIdSchema
      .merge(applicationIdParamSchema)
      .merge(submissionIdParamSchema)
      .merge(stipIdParamSchema)
      .parse(await context.params);
    const meta = getRequestMeta(request);
    const result = await stipulationService.deleteStipulation(
      ctx.dealershipId,
      ctx.userId,
      submissionId,
      stipId,
      meta
    );
    return Response.json({ data: result });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
