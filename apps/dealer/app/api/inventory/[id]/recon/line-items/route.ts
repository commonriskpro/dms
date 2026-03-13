import { NextRequest } from "next/server";
import { z } from "zod";
import * as reconService from "@/modules/inventory/service/recon";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
import { idParamSchema, reconLineItemBodySchema } from "../../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.write");
    const { id } = idParamSchema.parse(await context.params);
    const body = reconLineItemBodySchema.parse(await readSanitizedJson(request));
    const meta = getRequestMeta(request);
    const lineItem = await reconService.addLineItem(
      ctx.dealershipId,
      id,
      body,
      ctx.userId,
      meta
    );
    return jsonResponse(
      {
        data: {
          id: lineItem.id,
          description: lineItem.description,
          costCents: lineItem.costCents,
          category: lineItem.category,
          sortOrder: lineItem.sortOrder,
        },
      },
      201
    );
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
