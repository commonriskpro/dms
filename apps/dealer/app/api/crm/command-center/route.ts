import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";
import { getQueryObject } from "@/lib/api/query";
import { validationErrorResponse } from "@/lib/api/validate";
import * as commandCenterService from "@/modules/crm-pipeline-automation/service/command-center";

const querySchema = z.object({
  scope: z.enum(["mine", "team", "all"]).optional(),
  ownerId: z.string().uuid().optional(),
  stageId: z.string().uuid().optional(),
  status: z.enum(["OPEN", "WON", "LOST"]).optional(),
  source: z.string().max(100).optional(),
  q: z.string().max(200).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "crm.read");
    const query = querySchema.parse(getQueryObject(request));
    const data = await commandCenterService.getCommandCenterData(ctx.dealershipId, ctx.userId, {
      scope: query.scope ?? "all",
      ownerId: query.ownerId,
      stageId: query.stageId,
      status: query.status,
      source: query.source,
      q: query.q,
    });
    return jsonResponse({ data });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
