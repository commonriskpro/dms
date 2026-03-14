import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  readSanitizedJson,
} from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";
import * as pageService from "@/modules/websites-core/service/page";
import { serializePage } from "@/modules/websites-core/serialize";
import { pageIdParamSchema, updateWebsitePageBodySchema } from "@/modules/websites-core/schemas";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { pageId: string } }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "websites.write");
    const { pageId } = pageIdParamSchema.parse(params);
    const body = updateWebsitePageBodySchema.parse(await readSanitizedJson(request));
    const updated = await pageService.updatePage(ctx.dealershipId, pageId, {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.isEnabled !== undefined && { isEnabled: body.isEnabled }),
      ...(body.seoTitle !== undefined && { seoTitle: body.seoTitle }),
      ...(body.seoDescription !== undefined && { seoDescription: body.seoDescription }),
      ...(body.sectionsConfigJson !== undefined && { sectionsConfigJson: body.sectionsConfigJson as object }),
      ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
    });
    return jsonResponse({ data: serializePage(updated) });
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json(validationErrorResponse(e.issues), { status: 400 });
    return handleApiError(e);
  }
}
