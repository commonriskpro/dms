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
import * as lenderStipulationDb from "@/modules/finance-core/db/lender-stipulation";
import * as lenderStipulationService from "@/modules/finance-core/service/lender-stipulation";
import { updateLenderStipulationBodySchema } from "@/modules/finance-core/schemas";
import { serializeLenderStipulation } from "@/modules/finance-core/serialize";

export const dynamic = "force-dynamic";

const idParamSchema = z.object({ id: z.string().uuid() });

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.write");
    const { id } = idParamSchema.parse(await context.params);
    const body = await readSanitizedJson(request);
    const parsed = updateLenderStipulationBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const updated = await lenderStipulationService.updateStipulation(
      ctx.dealershipId,
      ctx.userId,
      id,
      {
        title: parsed.title,
        notes: parsed.notes,
        status: parsed.status,
        requiredAt: parsed.requiredAt ? new Date(parsed.requiredAt) : undefined,
        receivedAt: parsed.receivedAt ? new Date(parsed.receivedAt) : undefined,
        reviewedAt: parsed.reviewedAt ? new Date(parsed.reviewedAt) : undefined,
      },
      meta
    );
    return jsonResponse({ data: serializeLenderStipulation(updated) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.read");
    const { id } = idParamSchema.parse(await context.params);
    const stip = await lenderStipulationDb.getLenderStipulationById(
      ctx.dealershipId,
      id
    );
    if (!stip) {
      const { handleApiError } = await import("@/lib/api/handler");
      const { ApiError } = await import("@/lib/auth");
      return handleApiError(new ApiError("NOT_FOUND", "Stipulation not found"));
    }
    return jsonResponse({ data: serializeLenderStipulation(stip) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
