import { NextRequest } from "next/server";
import { z } from "zod";
import * as bulkService from "@/modules/inventory/service/bulk";
import { getAuthContext, guardPermission, handleApiError, jsonResponse } from "@/lib/api/handler";
import { listBulkImportJobsQuerySchema } from "../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { getQueryObject } from "@/lib/api/query";
import { listPayload } from "@/lib/api/list-response";

export const dynamic = "force-dynamic";

/**
 * GET /api/inventory/bulk/import — List bulk import jobs for the dealership.
 * Query: limit, offset, status (optional).
 * RBAC: inventory.read. Tenant-isolated.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.read");
    const query = listBulkImportJobsQuerySchema.parse(getQueryObject(request));
    const { data, total } = await bulkService.listBulkImportJobs(ctx.dealershipId, {
      limit: query.limit,
      offset: query.offset,
      status: query.status,
    });
    return jsonResponse(listPayload(data, total, query.limit, query.offset));
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
