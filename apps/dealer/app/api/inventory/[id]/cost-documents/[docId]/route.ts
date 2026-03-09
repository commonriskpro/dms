import { NextRequest } from "next/server";
import { z } from "zod";
import * as costLedger from "@/modules/inventory/service/cost-ledger";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  getRequestMeta,
} from "@/lib/api/handler";
import { costDocumentIdParamSchema } from "../../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.write");
    await guardPermission(ctx, "documents.write");
    const { id, docId } = costDocumentIdParamSchema.parse(await context.params);
    const doc = await costLedger.getCostDocument(ctx.dealershipId, docId);
    if (doc.vehicleId !== id) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "Cost document not found" } },
        { status: 404 }
      );
    }
    const meta = getRequestMeta(request);
    await costLedger.deleteCostDocument(ctx.dealershipId, docId, ctx.userId, meta);
    return new Response(null, { status: 204 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
