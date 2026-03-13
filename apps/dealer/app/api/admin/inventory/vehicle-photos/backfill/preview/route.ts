import { NextRequest } from "next/server";
import {
  getAuthContext,
  guardAnyPermission,
  handleApiError,
  jsonResponse,
  readSanitizedJson,
} from "@/lib/api/handler";
import { checkRateLimit, incrementRateLimit } from "@/lib/api/rate-limit";
import { validationErrorResponse } from "@/lib/api/validate";
import { previewBackfillForDealership } from "@/modules/inventory/service/vehicle-photo-backfill";
import { backfillBodySchema } from "../schemas";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/inventory/vehicle-photos/backfill/preview
 * Returns backfill plan (dry run) for the given dealership. Admin only.
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardAnyPermission(ctx, ["admin.roles.write", "admin.permissions.manage"]);

    const rlKey = `admin_backfill:${ctx.userId}`;
    if (!checkRateLimit(rlKey, "admin_backfill")) {
      return Response.json(
        { error: { code: "RATE_LIMITED", message: "Too many backfill requests" } },
        { status: 429 }
      );
    }

    const body = await readSanitizedJson(request);
    const parsed = backfillBodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(validationErrorResponse(parsed.error.issues), { status: 400 });
    }
    const { dealershipId, limitVehicles, cursor } = parsed.data;

    if (dealershipId !== ctx.dealershipId) {
      return Response.json(
        { error: { code: "FORBIDDEN", message: "Can only backfill your own dealership" } },
        { status: 403 }
      );
    }

    const preview = await previewBackfillForDealership({
      dealershipId,
      limitVehicles,
      cursor,
    });
    incrementRateLimit(rlKey, "admin_backfill");
    return jsonResponse({
      dealershipId: preview.dealershipId,
      vehicles: preview.vehicles,
      summary: preview.summary,
      nextOffset: preview.nextOffset,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
