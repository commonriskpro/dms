import { NextRequest } from "next/server";
import { z } from "zod";
import * as customersService from "@/modules/customers/service/customer";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";
import { getQueryObject } from "@/lib/api/query";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(100),
});

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "crm.read");
    const query = querySchema.parse(getQueryObject(request));
    const data = await customersService.listLeadSourceValues(ctx.dealershipId, {
      limit: query.limit,
    });
    return jsonResponse({ data });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
