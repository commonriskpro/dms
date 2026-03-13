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
import {
  createLenderApplicationBodySchema,
  listLenderApplicationsQuerySchema,
} from "@/modules/finance-core/schemas";
import { serializeLenderApplication } from "@/modules/finance-core/serialize";
import { getQueryObject } from "@/lib/api/query";
import { listPayload } from "@/lib/api/list-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.read");
    const query = listLenderApplicationsQuerySchema.parse(getQueryObject(request));
    const { data, total } = await lenderApplicationService.listLenderApplications(
      ctx.dealershipId,
      {
        creditApplicationId: query.creditApplicationId,
        dealId: query.dealId,
        status: query.status,
        limit: query.limit,
        offset: query.offset,
      }
    );
    return jsonResponse(
      listPayload(
        data.map((row) =>
          serializeLenderApplication(row as Parameters<typeof serializeLenderApplication>[0])
        ),
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

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.write");
    const body = await readSanitizedJson(request);
    const parsed = createLenderApplicationBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const created = await lenderApplicationService.createLenderApplication(
      ctx.dealershipId,
      ctx.userId,
      {
        creditApplicationId: parsed.creditApplicationId,
        dealId: parsed.dealId,
        lenderName: parsed.lenderName,
        externalApplicationRef: parsed.externalApplicationRef ?? null,
        aprBps: parsed.aprBps ?? null,
        maxAmountCents: parsed.maxAmountCents ?? null,
        maxAdvanceBps: parsed.maxAdvanceBps ?? null,
        termMonths: parsed.termMonths ?? null,
        downPaymentRequiredCents: parsed.downPaymentRequiredCents ?? null,
        decisionSummary: parsed.decisionSummary ?? null,
      },
      meta
    );
    return jsonResponse({
      data: serializeLenderApplication({
        ...created,
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
