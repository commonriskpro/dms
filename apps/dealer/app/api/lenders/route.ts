import { NextRequest } from "next/server";
import { z } from "zod";
import * as lenderService from "@/modules/lender-integration/service/lender";
import {
  getAuthContext,
  getRequestMeta,
  guardPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";
import {
  listLendersQuerySchema,
  createLenderBodySchema,
} from "@/modules/lender-integration/schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { serializeLender } from "@/modules/lender-integration/serialize";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "lenders.read");
    const query = listLendersQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams)
    );
    const { data, total } = await lenderService.listLenders(ctx.dealershipId, {
      limit: query.limit,
      offset: query.offset,
      isActive: query.isActive,
    });
    return jsonResponse({
      data: data.map(serializeLender),
      meta: { total, limit: query.limit, offset: query.offset },
    });
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
    await guardPermission(ctx, "lenders.write");
    const body = createLenderBodySchema.parse(await request.json());
    const meta = getRequestMeta(request);
    const created = await lenderService.createLender(
      ctx.dealershipId,
      ctx.userId,
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
    return jsonResponse({ data: serializeLender(created) }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
