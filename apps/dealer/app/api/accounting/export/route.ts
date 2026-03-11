import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
} from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";
import { exportAccountingTransactions } from "@/modules/reporting-core/service/accounting-export";
import { accountingExportQuerySchema } from "@/modules/reporting-core/schemas";
import { getQueryObject } from "@/lib/api/query";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.read");
    const query = accountingExportQuerySchema.parse(
      getQueryObject(request)
    );
    const csv = await exportAccountingTransactions({
      dealershipId: ctx.dealershipId,
      from: query.from,
      to: query.to,
      accountId: query.accountId ?? undefined,
      format: query.format,
    });
    const filename = `accounting-export-${query.from}-${query.to}.csv`;
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
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
