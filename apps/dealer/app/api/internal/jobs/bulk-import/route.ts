import { NextRequest } from "next/server";
import { runTrackedInternalJob } from "@/lib/internal-job-run";
import * as bulkService from "@/modules/inventory/service/bulk";
import { authorizeInternalJobRequest, internalJobError } from "../route-helpers";
import { internalBulkImportJobSchema } from "../schemas";
import { readSanitizedJson } from "@/lib/api/handler";

export async function POST(request: NextRequest) {
  const authFailure = await authorizeInternalJobRequest(request);
  if (authFailure) return authFailure;

  let body: unknown;
  try {
    body = await readSanitizedJson(request);
  } catch {
    return internalJobError("VALIDATION_ERROR", "Invalid JSON body", 422);
  }

  const parsed = internalBulkImportJobSchema.safeParse(body);
  if (!parsed.success) {
    return internalJobError("VALIDATION_ERROR", "Validation failed", 422, parsed.error.flatten());
  }

  const { dealershipId, importId, requestedByUserId, rows } = parsed.data;
  const result = await runTrackedInternalJob(dealershipId, async () => {
    const data = await bulkService.runBulkImportJob(
      dealershipId,
      importId,
      requestedByUserId,
      rows
    );
    return {
      data,
      summary: {
        processed: data.processedRows,
        failed: data.errorCount,
      },
    };
  });

  return Response.json({ data: result.data, meta: { runId: result.runId } });
}
