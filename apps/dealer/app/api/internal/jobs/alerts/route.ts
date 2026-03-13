import { NextRequest } from "next/server";
import { runTrackedInternalJob } from "@/lib/internal-job-run";
import { authorizeInternalJobRequest, internalJobError } from "../route-helpers";
import { internalAlertJobSchema } from "../schemas";
import { runAlertJob } from "@/modules/intelligence/service/async-jobs";
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

  const parsed = internalAlertJobSchema.safeParse(body);
  if (!parsed.success) {
    return internalJobError("VALIDATION_ERROR", "Validation failed", 422, parsed.error.flatten());
  }

  const { dealershipId, ruleId, triggeredAt } = parsed.data;
  const result = await runTrackedInternalJob(dealershipId, async () => {
    const data = await runAlertJob(dealershipId, ruleId, triggeredAt);
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
