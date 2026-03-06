import { NextRequest } from "next/server";
import { z } from "zod";
import * as bulkService from "@/modules/inventory/service/bulk";
import { getAuthContext, guardPermission, handleApiError, jsonResponse } from "@/lib/api/handler";
import { jobIdParamSchema } from "../../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.read");
    const { jobId } = jobIdParamSchema.parse(await context.params);
    const job = await bulkService.getBulkImportJob(ctx.dealershipId, jobId);
    return jsonResponse({
      data: {
        id: job.id,
        status: job.status,
        totalRows: job.totalRows,
        processedRows: job.processedRows,
        errorsJson: job.errorsJson,
        createdAt: job.createdAt.toISOString(),
        completedAt: job.completedAt?.toISOString() ?? null,
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
