import { NextRequest } from "next/server";
import * as appraisalService from "@/modules/inventory/service/appraisal";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "inventory.appraisals.write");
    const { id } = await params;
    const updated = await appraisalService.approveAppraisal(ctx.dealershipId, ctx.userId, id);
    return jsonResponse({
      data: {
        id: updated.id,
        status: updated.status,
        expectedRetailCents: updated.expectedRetailCents.toString(),
        expectedProfitCents: updated.expectedProfitCents.toString(),
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
