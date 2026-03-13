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
  updateSubmissionFundingBodySchema,
} from "@/modules/lender-integration/schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { errorResponse } from "@/lib/api/errors";
import { serializeFinanceSubmission } from "@/modules/lender-integration/serialize";

const dealIdSchema = z.object({ id: z.string().uuid() });

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
    const body = updateSubmissionFundingBodySchema.parse(await readSanitizedJson(request));
    const meta = getRequestMeta(request);
    const updated = await submissionService.updateSubmissionFunding(
      ctx.dealershipId,
      ctx.userId,
      dealId,
      applicationId,
      submissionId,
      {
        fundingStatus: body.fundingStatus,
        fundedAt: body.fundedAt,
        fundedAmountCents: body.fundedAmountCents ?? undefined,
        reserveFinalCents: body.reserveFinalCents ?? undefined,
      },
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
