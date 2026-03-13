import { NextRequest } from "next/server";
import { runTrackedInternalJob } from "@/lib/internal-job-run";
import { authorizeInternalJobRequest, internalJobError } from "../route-helpers";
import { internalVinFollowUpJobSchema } from "../schemas";
import { runVinFollowUpJob } from "@/modules/inventory/service/vin-followup";
import { readSanitizedJson } from "@/lib/api/handler";

export async function POST(request: NextRequest) {
  const handlerStartedAt = Date.now();
  const authFailure = await authorizeInternalJobRequest(request);
  if (authFailure) return authFailure;

  let body: unknown;
  try {
    body = await readSanitizedJson(request);
  } catch {
    return internalJobError("VALIDATION_ERROR", "Invalid JSON body", 422);
  }

  const parsed = internalVinFollowUpJobSchema.safeParse(body);
  if (!parsed.success) {
    return internalJobError("VALIDATION_ERROR", "Validation failed", 422, parsed.error.flatten());
  }

  const { dealershipId, vehicleId, vin } = parsed.data;
  const serviceStartedAt = Date.now();
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
  const serviceMs = Date.now() - serviceStartedAt;
  const handlerMs = Date.now() - handlerStartedAt;
  return Response.json(
    { data: result.data, meta: { runId: result.runId } },
    {
      headers: {
        "x-bridge-handler-ms": String(handlerMs),
        "x-bridge-service-ms": String(serviceMs),
      },
    }
  );
}
