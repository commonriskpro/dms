import { NextRequest } from "next/server";
import { z } from "zod";
import { exportInventoryCsv } from "@/modules/reports/service";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  getRequestMeta,
} from "@/lib/api/handler";
import { exportInventoryQuerySchema } from "../../schemas";
import { validationErrorResponse } from "@/lib/api/validate";
import { auditLog } from "@/lib/audit";
import {
  checkRateLimit,
  incrementRateLimit,
  getClientIdentifier,
} from "@/lib/api/rate-limit";
import { ApiError } from "@/lib/auth";
import { getQueryObject } from "@/lib/api/query";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "reports.export");

    const identifier = getClientIdentifier(request);
    if (!checkRateLimit(identifier, "report_export")) {
      throw new ApiError("RATE_LIMITED", "Too many export requests");
    }

    const query = exportInventoryQuerySchema.parse(
      getQueryObject(request)
    );
    const asOf = query.asOf ?? new Date().toISOString().slice(0, 10);

    const csv = await exportInventoryCsv({
      dealershipId: ctx.dealershipId,
      asOf: query.asOf,
      status: query.status,
    });

    incrementRateLimit(identifier, "report_export");
    const meta = getRequestMeta(request);
    await auditLog({
      dealershipId: ctx.dealershipId,
      actorUserId: ctx.userId,
      action: "report.exported",
      entity: "Report",
      metadata: {
        reportName: "inventory",
        asOf,
        format: "csv",
      },
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    });

    const safeAsOf = asOf.replace(/[^0-9-]/g, "-");
    const filename = `inventory-${safeAsOf}.csv`;
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
