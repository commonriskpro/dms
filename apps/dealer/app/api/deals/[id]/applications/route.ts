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
  listApplicationsQuerySchema,
  createApplicationBodySchema,
} from "@/modules/lender-integration/schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { serializeFinanceApplication } from "@/modules/lender-integration/serialize";
import { getQueryObject } from "@/lib/api/query";
import { listPayload } from "@/lib/api/list-response";

const dealIdSchema = z.object({ id: z.string().uuid() });

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.read");
    const { id: dealId } = dealIdSchema.parse(await context.params);
    const query = listApplicationsQuerySchema.parse(getQueryObject(request));
    const { data, total } = await applicationService.listApplications(
      ctx.dealershipId,
      dealId,
      { limit: query.limit, offset: query.offset }
    );
    return jsonResponse(
      listPayload(
        data.map(serializeFinanceApplication),
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
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.write");
    const { id: dealId } = dealIdSchema.parse(await context.params);
    const body = createApplicationBodySchema.parse(await readSanitizedJson(request).catch(() => ({})));
    const meta = getRequestMeta(request);
    const created = await applicationService.createApplication(
      ctx.dealershipId,
      ctx.userId,
      dealId,
      { status: body.status },
      meta
    );
    return jsonResponse({ data: serializeFinanceApplication(created) }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
