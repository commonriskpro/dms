import { NextRequest } from "next/server";
import { z } from "zod";
import * as marketplaceService from "@/modules/integrations/service/marketplace";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";
import { withCache } from "@/lib/infrastructure/cache/cacheHelpers";
import { inventoryFeedKey } from "@/lib/infrastructure/cache/cacheKeys";
import { getQueryObject } from "@/lib/api/query";

const querySchema = z.object({
  format: z.enum(["facebook", "autotrader"]),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

const FEED_CACHE_TTL_SECONDS = 300;

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.read");
    const query = querySchema.parse(getQueryObject(request));

    const key = inventoryFeedKey(ctx.dealershipId, query.format);
    const result = await withCache(key, FEED_CACHE_TTL_SECONDS, () =>
      marketplaceService.buildFeed(ctx.dealershipId, query.format, { limit: query.limit })
    );

    return jsonResponse({
      data: result,
      meta: { format: query.format, count: result.items.length },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
