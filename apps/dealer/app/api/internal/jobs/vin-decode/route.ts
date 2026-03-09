import { NextRequest } from "next/server";
import { runTrackedInternalJob } from "@/lib/internal-job-run";
import { authorizeInternalJobRequest, internalJobError } from "../route-helpers";
import { internalVinFollowUpJobSchema } from "../schemas";
import { runVinFollowUpJob } from "@/modules/inventory/service/vin-followup";

export async function POST(request: NextRequest) {
  const authFailure = await authorizeInternalJobRequest(request);
  if (authFailure) return authFailure;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return internalJobError("VALIDATION_ERROR", "Invalid JSON body", 422);
  }

  const parsed = internalVinFollowUpJobSchema.safeParse(body);
  if (!parsed.success) {
    return internalJobError("VALIDATION_ERROR", "Validation failed", 422, parsed.error.flatten());
  }

  const { dealershipId, vehicleId, vin } = parsed.data;
  const result = await runTrackedInternalJob(dealershipId, async () => {
    const data = await runVinFollowUpJob(dealershipId, vehicleId, vin);
    return {
      data,
      summary: {
        processed: data.skippedReason ? 0 : 1,
        failed: 0,
        skippedReason: data.skippedReason ?? null,
      },
    };
  });

  return Response.json({ data: result.data, meta: { runId: result.runId } });
}
