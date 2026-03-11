import { NextRequest } from "next/server";
import * as inboxService from "@/modules/customers/service/inbox";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";
import { z } from "zod";
import { getQueryObject } from "@/lib/api/query";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "customers.read");
    const query = querySchema.parse(getQueryObject(request));
    const result = await inboxService.listConversations(ctx.dealershipId, {
      limit: query.limit,
      offset: query.offset,
    });
    return jsonResponse({
      data: result.data,
      meta: result.meta,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
