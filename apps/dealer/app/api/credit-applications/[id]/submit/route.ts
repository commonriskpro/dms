import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
} from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";
import * as creditApplicationService from "@/modules/finance-core/service/credit-application";
import { serializeCreditApplication } from "@/modules/finance-core/serialize";

export const dynamic = "force-dynamic";

const idParamSchema = z.object({ id: z.string().uuid() });

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.write");
    const { id } = idParamSchema.parse(await context.params);
    const meta = getRequestMeta(request);
    const updated = await creditApplicationService.submitCreditApplication(
      ctx.dealershipId,
      ctx.userId,
      id,
      meta
    );
    return jsonResponse({ data: serializeCreditApplication(updated) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
