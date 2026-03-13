import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  readSanitizedJson,
} from "@/lib/api/handler";
import {
  getInventoryListViewPreference,
  setInventoryListViewPreference,
  isValidView,
} from "@/modules/inventory/service/inventory-list-view-preference";

export const dynamic = "force-dynamic";

const patchBodySchema = z.object({ view: z.enum(["table", "cards"]) });

/** GET: return current inventory list view preference. */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.read");

    const view = await getInventoryListViewPreference({
      dealershipId: ctx.dealershipId,
      userId: ctx.userId,
    });

    return jsonResponse({
      data: { view: view ?? "table" },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/** PATCH: set inventory list view preference. */
export async function PATCH(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.read");

    const body = await readSanitizedJson(request);
    const parsed = patchBodySchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(
        { error: { code: "VALIDATION_ERROR", message: "Invalid view", details: parsed.error.issues } },
        400
      );
    }
    const { view } = parsed.data;
    if (!isValidView(view)) {
      return jsonResponse(
        { error: { code: "VALIDATION_ERROR", message: "view must be table or cards" } },
        400
      );
    }

    await setInventoryListViewPreference({
      dealershipId: ctx.dealershipId,
      userId: ctx.userId,
      view,
    });

    return jsonResponse({ data: { ok: true, view } });
  } catch (e) {
    return handleApiError(e);
  }
}
