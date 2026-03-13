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
  getOpportunitiesViewPreference,
  isValidOpportunitiesView,
  setOpportunitiesViewPreference,
} from "@/modules/crm-pipeline-automation/service/opportunities-view-preference";

export const dynamic = "force-dynamic";

const patchBodySchema = z.object({
  view: z.enum(["board", "list"]),
});

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "crm.read");

    const view = await getOpportunitiesViewPreference({
      dealershipId: ctx.dealershipId,
      userId: ctx.userId,
    });

    return jsonResponse({
      data: {
        view: view ?? "board",
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "crm.read");

    const body = await readSanitizedJson(request);
    const parsed = patchBodySchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(
        { error: { code: "VALIDATION_ERROR", message: "Invalid view", details: parsed.error.issues } },
        400
      );
    }

    const { view } = parsed.data;
    if (!isValidOpportunitiesView(view)) {
      return jsonResponse(
        { error: { code: "VALIDATION_ERROR", message: "view must be board or list" } },
        400
      );
    }

    await setOpportunitiesViewPreference({
      dealershipId: ctx.dealershipId,
      userId: ctx.userId,
      view,
    });

    return jsonResponse({ data: { ok: true, view } });
  } catch (e) {
    return handleApiError(e);
  }
}
