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
import * as vaultService from "@/modules/finance-core/service/documents";

export const dynamic = "force-dynamic";

const idParamSchema = z.object({ id: z.string().uuid() });

function serializeDealDocument(doc: {
  id: string;
  dealId: string;
  creditApplicationId: string | null;
  lenderApplicationId: string | null;
  category: string;
  title: string;
  mimeType: string;
  sizeBytes: number;
  uploadedByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: doc.id,
    dealId: doc.dealId,
    creditApplicationId: doc.creditApplicationId,
    lenderApplicationId: doc.lenderApplicationId,
    category: doc.category,
    title: doc.title,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    uploadedByUserId: doc.uploadedByUserId,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.read");
    const { id } = idParamSchema.parse(await context.params);
    const doc = await vaultService.getDealDocument(ctx.dealershipId, id);
    return jsonResponse({ data: serializeDealDocument(doc) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.write");
    const { id } = idParamSchema.parse(await context.params);
    const meta = getRequestMeta(request);
    await vaultService.deleteDealDocument(ctx.dealershipId, ctx.userId, id, meta);
    return new Response(null, { status: 204 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
