import { NextRequest } from "next/server";
import { z } from "zod";
import * as stipulationService from "@/modules/lender-integration/service/stipulation";
import {
  getAuthContext,
  getRequestMeta,
  guardPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";
import {
  applicationIdParamSchema,
  submissionIdParamSchema,
  listStipulationsQuerySchema,
  createStipulationBodySchema,
} from "@/modules/lender-integration/schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { serializeStipulation } from "@/modules/lender-integration/serialize";

const dealIdSchema = z.object({ id: z.string().uuid() });

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{ id: string; applicationId: string; submissionId: string }>;
  }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.read");
    const { submissionId } = dealIdSchema
      .merge(applicationIdParamSchema)
      .merge(submissionIdParamSchema)
      .parse(await context.params);
    const query = listStipulationsQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    );
    const { data, total } = await stipulationService.listStipulations(
      ctx.dealershipId,
      submissionId,
      {
        limit: query.limit,
        offset: query.offset,
        status: query.status,
        stipType: query.stipType,
      }
    );
    return jsonResponse({
      data: data.map(serializeStipulation),
      meta: { total, limit: query.limit, offset: query.offset },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{ id: string; applicationId: string; submissionId: string }>;
  }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.write");
    const { submissionId } = dealIdSchema
      .merge(applicationIdParamSchema)
      .merge(submissionIdParamSchema)
      .parse(await context.params);
    const body = createStipulationBodySchema.parse(await request.json());
    const meta = getRequestMeta(request);
    const created = await stipulationService.createStipulation(
      ctx.dealershipId,
      ctx.userId,
      submissionId,
      {
        stipType: body.stipType,
        status: body.status,
        requestedAt: body.requestedAt,
        notes: body.notes,
      },
      meta
    );
    return jsonResponse({ data: serializeStipulation(created) }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
