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
import { idParamSchema, reconUpdateBodySchema } from "../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.read");
    const { id } = idParamSchema.parse(await context.params);
    const recon = await reconService.getRecon(ctx.dealershipId, id);
    if (!recon) {
      return jsonResponse({ data: null });
    }
    const totalCents = recon.lineItems.reduce((s, i) => s + i.costCents, 0);
    return jsonResponse({
      data: {
        id: recon.id,
        vehicleId: recon.vehicleId,
        status: recon.status,
        dueDate: recon.dueDate,
        totalCents,
        lineItems: recon.lineItems.map((li) => ({
          id: li.id,
          description: li.description,
          costCents: li.costCents,
          category: li.category,
          sortOrder: li.sortOrder,
        })),
      },
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
    await guardPermission(ctx, "inventory.write");
    const { id } = idParamSchema.parse(await context.params);
    const body = await readSanitizedJson(request);
    const data = reconUpdateBodySchema.parse(body);
    const meta = getRequestMeta(request);
    const dueDate =
      data.dueDate != null
        ? (data.dueDate === null ? null : new Date(data.dueDate))
        : undefined;
    const recon = await reconService.updateRecon(
      ctx.dealershipId,
      id,
      { status: data.status, dueDate },
      ctx.userId,
      meta
    );
    return jsonResponse({
      data: {
        id: recon.id,
        vehicleId: recon.vehicleId,
        status: recon.status,
        dueDate: recon.dueDate,
        totalCents: recon.totalCents,
        lineItems: recon.lineItems.map((li) => ({
          id: li.id,
          description: li.description,
          costCents: li.costCents,
          category: li.category,
          sortOrder: li.sortOrder,
        })),
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
