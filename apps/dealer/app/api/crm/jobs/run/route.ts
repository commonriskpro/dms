import { NextRequest } from "next/server";
import pLimit from "p-limit";
import { getAuthContext, guardPermission, handleApiError, jsonResponse } from "@/lib/api/handler";
import * as jobWorker from "@/modules/crm-pipeline-automation/service/job-worker";
import { prisma } from "@/lib/db";

const CRM_CRON_CONCURRENCY = 3;

/**
 * Job worker: run pending CRM jobs for the authenticated dealership.
 * Call from Vercel cron (e.g. every minute) or a polling worker.
 * Requires crm.write. dealershipId comes from auth only (never from body/query).
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "crm.write");
    const result = await jobWorker.runJobWorker(ctx.dealershipId);
    return jsonResponse({ data: result });
  } catch (e) {
    return handleApiError(e);
  }
}

/**
 * Run worker for all dealerships. Requires valid CRON_SECRET in Authorization: Bearer <secret>.
 * No query or body parameters; dealershipId is never accepted from client.
 */
export async function GET(request: NextRequest) {
  const secret = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return Response.json({ error: { code: "UNAUTHORIZED", message: "Invalid cron secret" } }, { status: 401 });
  }
  const dealerships = await prisma.dealership.findMany({ select: { id: true } });
  const limit = pLimit(CRM_CRON_CONCURRENCY);
  const results = await Promise.all(
    dealerships.map((d) =>
      limit(() =>
        jobWorker.runJobWorker(d.id).then((result) => ({ dealershipId: d.id, ...result }))
      )
    )
  );
  return jsonResponse({ data: results });
}
