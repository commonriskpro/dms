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
import * as lenderApplicationService from "@/modules/finance-core/service/lender-application";
import { updateLenderApplicationBodySchema } from "@/modules/finance-core/schemas";
import { serializeLenderApplication } from "@/modules/finance-core/serialize";

export const dynamic = "force-dynamic";

const idParamSchema = z.object({ id: z.string().uuid() });

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.read");
    const { id } = idParamSchema.parse(await context.params);
    const app = await lenderApplicationService.getLenderApplication(
      ctx.dealershipId,
      id
    );
    return jsonResponse({
      data: serializeLenderApplication({
        ...app,
        _count: { stipulations: app.stipulations.length },
      }),
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.write");
    const { id } = idParamSchema.parse(await context.params);
    const body = await readSanitizedJson(request);
    const parsed = updateLenderApplicationBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const updated = await lenderApplicationService.updateLenderApplication(
      ctx.dealershipId,
      ctx.userId,
      id,
      {
        lenderName: parsed.lenderName,
        status: parsed.status,
        externalApplicationRef: parsed.externalApplicationRef,
        aprBps: parsed.aprBps,
        maxAmountCents:
          parsed.maxAmountCents != null
            ? BigInt(parsed.maxAmountCents)
            : undefined,
        maxAdvanceBps: parsed.maxAdvanceBps,
        termMonths: parsed.termMonths,
        downPaymentRequiredCents:
          parsed.downPaymentRequiredCents != null
            ? BigInt(parsed.downPaymentRequiredCents)
            : undefined,
        decisionSummary: parsed.decisionSummary,
        submittedAt: parsed.submittedAt ? new Date(parsed.submittedAt) : undefined,
        decisionedAt: parsed.decisionedAt ? new Date(parsed.decisionedAt) : undefined,
      },
      meta
    );
    return jsonResponse({
      data: serializeLenderApplication({
        ...updated,
        _count: { stipulations: 0 },
      }),
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
