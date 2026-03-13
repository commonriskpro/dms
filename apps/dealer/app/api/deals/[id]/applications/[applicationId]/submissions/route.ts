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
  listSubmissionsQuerySchema,
  createSubmissionBodySchema,
} from "@/modules/lender-integration/schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { serializeFinanceSubmission } from "@/modules/lender-integration/serialize";
import { getQueryObject } from "@/lib/api/query";
import { listPayload } from "@/lib/api/list-response";

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
    const query = listSubmissionsQuerySchema.parse(getQueryObject(request));
    const { data, total } = await submissionService.listSubmissions(
      ctx.dealershipId,
      dealId,
      applicationId,
      { limit: query.limit, offset: query.offset, status: query.status }
    );
    return jsonResponse(
      listPayload(
        data.map(serializeFinanceSubmission),
        total,
        query.limit,
        query.offset
      )
    );
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; applicationId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.write");
    const { id: dealId, applicationId } = dealIdSchema
      .merge(applicationIdParamSchema)
      .parse(await context.params);
    const body = createSubmissionBodySchema.parse(await readSanitizedJson(request));
    const meta = getRequestMeta(request);
    const created = await submissionService.createSubmission(
      ctx.dealershipId,
      ctx.userId,
      dealId,
      applicationId,
      {
        lenderId: body.lenderId,
        reserveEstimateCents: body.reserveEstimateCents ?? null,
      },
      meta
    );
    return jsonResponse({ data: serializeFinanceSubmission(created) }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
