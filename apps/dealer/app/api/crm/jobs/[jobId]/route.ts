import { NextRequest } from "next/server";
import { z } from "zod";
import * as jobDb from "@/modules/crm-pipeline-automation/db/job";
import { getAuthContext, guardPermission, handleApiError, jsonResponse } from "@/lib/api/handler";
import { jobIdParamSchema } from "../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const ctx = await getAuthContext(_req);
    await guardPermission(ctx, "crm.read");
    const { jobId } = jobIdParamSchema.parse(await context.params);
    const data = await jobDb.getJobById(ctx.dealershipId, jobId);
    if (!data) {
      const { ApiError } = await import("@/lib/auth");
      throw new ApiError("NOT_FOUND", "Job not found");
    }
    return jsonResponse({ data });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
