import { NextRequest } from "next/server";
import { z } from "zod";
import * as submissionService from "@/modules/lender-integration/service/submission";
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
  updateSubmissionBodySchema,
} from "@/modules/lender-integration/schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { errorResponse } from "@/lib/api/errors";
import { serializeFinanceSubmission } from "@/modules/lender-integration/serialize";

const dealIdSchema = z.object({ id: z.string().uuid() });

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; applicationId: string; submissionId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.read");
    const { id: dealId, applicationId, submissionId } = dealIdSchema
      .merge(applicationIdParamSchema)
      .merge(submissionIdParamSchema)
      .parse(await context.params);
    const sub = await submissionService.getSubmission(
      ctx.dealershipId,
      dealId,
      applicationId,
      submissionId
    );
    if (!sub) {
      return Response.json(
        errorResponse("NOT_FOUND", "Submission not found"),
        { status: 404 }
      );
    }
    return jsonResponse({ data: serializeFinanceSubmission(sub) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; applicationId: string; submissionId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.write");
    const { id: dealId, applicationId, submissionId } = dealIdSchema
      .merge(applicationIdParamSchema)
      .merge(submissionIdParamSchema)
      .parse(await context.params);
    const body = updateSubmissionBodySchema.parse(await readSanitizedJson(request));
    const meta = getRequestMeta(request);
    const data: Record<string, unknown> = {};
    if (body.status !== undefined) data.status = body.status;
    if (body.decisionStatus !== undefined) data.decisionStatus = body.decisionStatus;
    if (body.approvedTermMonths !== undefined) data.approvedTermMonths = body.approvedTermMonths;
    if (body.approvedAprBps !== undefined) data.approvedAprBps = body.approvedAprBps;
    if (body.approvedPaymentCents !== undefined) data.approvedPaymentCents = body.approvedPaymentCents;
    if (body.maxAdvanceCents !== undefined) data.maxAdvanceCents = body.maxAdvanceCents;
    if (body.decisionNotes !== undefined) data.decisionNotes = body.decisionNotes;
    if (body.reserveEstimateCents !== undefined) data.reserveEstimateCents = body.reserveEstimateCents;
    const updated = await submissionService.updateSubmission(
      ctx.dealershipId,
      ctx.userId,
      dealId,
      applicationId,
      submissionId,
      data as Parameters<typeof submissionService.updateSubmission>[5],
      meta
    );
    if (!updated) {
      return Response.json(errorResponse("NOT_FOUND", "Submission not found"), { status: 404 });
    }
    return jsonResponse({ data: serializeFinanceSubmission(updated) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
