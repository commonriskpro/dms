import { NextRequest } from "next/server";
import pLimit from "p-limit";
import { getAuthContext, guardPermission, handleApiError, jsonResponse } from "@/lib/api/handler";
import { enqueueCrmExecution } from "@/lib/infrastructure/jobs/enqueueCrmExecution";
import * as dealershipService from "@/modules/admin-core/service/dealership";

const CRM_CRON_CONCURRENCY = 3;

/**
 * CRM execution trigger: enqueue dealership-scoped CRM execution for the authenticated dealership.
 * Requires crm.write. dealershipId comes from auth only (never from body/query).
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "crm.write");
    const result = await enqueueCrmExecution({
      dealershipId: ctx.dealershipId,
      source: "manual",
      triggeredByUserId: ctx.userId,
    });
    if (!result.enqueued) {
      return Response.json(
        { error: { code: "QUEUE_UNAVAILABLE", message: "CRM execution queue unavailable", details: { reason: result.reason } } },
        { status: 503 }
      );
    }
    return jsonResponse({ data: { enqueued: true } }, 202);
  } catch (e) {
    return handleApiError(e);
  }
}

/**
 * Enqueue CRM execution for all dealerships. Requires valid CRON_SECRET in Authorization: Bearer <secret>.
 * No query or body parameters; dealershipId is never accepted from client.
 */
export async function GET(request: NextRequest) {
  const secret = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return Response.json({ error: { code: "UNAUTHORIZED", message: "Invalid cron secret" } }, { status: 401 });
  }
  const dealershipIds = await dealershipService.listAllDealershipIds();
  const limit = pLimit(CRM_CRON_CONCURRENCY);
  const results = await Promise.all(
    dealershipIds.map((dealershipId) =>
      limit(() =>
        enqueueCrmExecution({ dealershipId, source: "cron" }).then((result) => ({
          dealershipId,
          ...result,
        }))
      )
    )
  );
  const failed = results.filter((result) => !result.enqueued);
  if (failed.length > 0) {
    return Response.json(
      {
        error: {
          code: "QUEUE_UNAVAILABLE",
          message: "Failed to enqueue CRM execution for one or more dealerships",
          details: { results },
        },
      },
      { status: 503 }
    );
  }
  return jsonResponse({ data: results }, 202);
}
