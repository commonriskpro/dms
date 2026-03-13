import { NextRequest } from "next/server";
import { authorizeInternalJobRequest, internalJobError } from "../route-helpers";
import { internalCrmExecutionJobSchema } from "../schemas";
import { runJobWorker } from "@/modules/crm-pipeline-automation/service/job-worker";
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

  const parsed = internalCrmExecutionJobSchema.safeParse(body);
  if (!parsed.success) {
    return internalJobError("VALIDATION_ERROR", "Validation failed", 422, parsed.error.flatten());
  }

  const data = await runJobWorker(parsed.data.dealershipId);
  return Response.json({ data });
}
