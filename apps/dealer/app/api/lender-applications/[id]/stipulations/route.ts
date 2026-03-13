import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";
import * as lenderStipulationService from "@/modules/finance-core/service/lender-stipulation";
import { createLenderStipulationBodySchema } from "@/modules/finance-core/schemas";
import { serializeLenderStipulation } from "@/modules/finance-core/serialize";

export const dynamic = "force-dynamic";

const idParamSchema = z.object({ id: z.string().uuid() });

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.read");
    const { id: lenderApplicationId } = idParamSchema.parse(await context.params);
    const list = await lenderStipulationService.listStipulations(
      ctx.dealershipId,
      lenderApplicationId
    );
    return jsonResponse({
      data: list.map(serializeLenderStipulation),
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
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.write");
    const { id: lenderApplicationId } = idParamSchema.parse(await context.params);
    const body = await readSanitizedJson(request);
    const parsed = createLenderStipulationBodySchema.parse({
      ...body,
      lenderApplicationId,
    });
    const meta = getRequestMeta(request);
    const created = await lenderStipulationService.createStipulation(
      ctx.dealershipId,
      ctx.userId,
      {
        lenderApplicationId,
        type: parsed.type,
        title: parsed.title,
        notes: parsed.notes ?? null,
        requiredAt: parsed.requiredAt ?? null,
      },
      meta
    );
    return jsonResponse({
      data: serializeLenderStipulation(created),
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
