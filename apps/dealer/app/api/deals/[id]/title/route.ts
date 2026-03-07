import { NextRequest } from "next/server";
import { z } from "zod";
import * as titleService from "@/modules/deals/service/title";
import { getAuthContext, guardPermission, handleApiError, jsonResponse } from "@/lib/api/handler";
import { dealIdParamSchema } from "../../schemas";

export const dynamic = "force-dynamic";

function serializeDealTitle(t: {
  id: string;
  dealId: string;
  dealershipId: string;
  titleStatus: string;
  titleNumber: string | null;
  lienholderName: string | null;
  lienReleasedAt: Date | null;
  sentToDmvAt: Date | null;
  receivedFromDmvAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: t.id,
    dealId: t.dealId,
    dealershipId: t.dealershipId,
    titleStatus: t.titleStatus,
    titleNumber: t.titleNumber,
    lienholderName: t.lienholderName,
    lienReleasedAt: t.lienReleasedAt?.toISOString() ?? null,
    sentToDmvAt: t.sentToDmvAt?.toISOString() ?? null,
    receivedFromDmvAt: t.receivedFromDmvAt?.toISOString() ?? null,
    notes: t.notes,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "deals.read");
    const { id } = dealIdParamSchema.parse(await context.params);
    const title = await titleService.getDealTitle(ctx.dealershipId, id);
    if (!title) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "Title record not found" } },
        { status: 404 }
      );
    }
    return jsonResponse({ data: serializeDealTitle(title) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: e.issues } },
        { status: 400 }
      );
    }
    return handleApiError(e);
  }
}
