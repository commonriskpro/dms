import { NextRequest } from "next/server";
import { z } from "zod";
import * as lenderService from "@/modules/lender-integration/service/lender";
import {
  getAuthContext,
  getRequestMeta,
  guardPermission,
  handleApiError,
  jsonResponse,
  readSanitizedJson,
} from "@/lib/api/handler";
import { lenderIdParamSchema, updateLenderBodySchema } from "@/modules/lender-integration/schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { errorResponse } from "@/lib/api/errors";
import { serializeLender } from "@/modules/lender-integration/serialize";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "lenders.read");
    const { id } = lenderIdParamSchema.parse(await context.params);
    const lender = await lenderService.getLender(ctx.dealershipId, id);
    if (!lender) {
      return Response.json(
        errorResponse("NOT_FOUND", "Lender not found"),
        { status: 404 }
      );
    }
    return jsonResponse({ data: serializeLender(lender) });
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
    await guardPermission(ctx, "lenders.write");
    const { id } = lenderIdParamSchema.parse(await context.params);
    const body = updateLenderBodySchema.parse(await readSanitizedJson(request));
    const meta = getRequestMeta(request);
    const updated = await lenderService.updateLender(
      ctx.dealershipId,
      ctx.userId,
      id,
      {
        name: body.name,
        lenderType: body.lenderType,
        contactEmail: body.contactEmail,
        contactPhone: body.contactPhone,
        externalSystem: body.externalSystem,
        isActive: body.isActive,
      },
      meta
    );
    if (!updated) {
      return Response.json(errorResponse("NOT_FOUND", "Lender not found"), { status: 404 });
    }
    return jsonResponse({ data: serializeLender(updated) });
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
    await guardPermission(ctx, "lenders.write");
    const { id } = lenderIdParamSchema.parse(await context.params);
    const meta = getRequestMeta(request);
    const updated = await lenderService.deactivateLender(
      ctx.dealershipId,
      ctx.userId,
      id,
      meta
    );
    if (!updated) {
      return Response.json(errorResponse("NOT_FOUND", "Lender not found"), { status: 404 });
    }
    return jsonResponse({ data: serializeLender(updated) });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
