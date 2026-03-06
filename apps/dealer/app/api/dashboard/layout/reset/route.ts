import { NextRequest } from "next/server";
import {
  getAuthContext,
  handleApiError,
  jsonResponse,
  guardAnyPermission,
  getRequestMeta,
} from "@/lib/api/handler";
import { auditLog } from "@/lib/audit";
import { resetLayout } from "@/modules/dashboard/service/dashboard-layout-persistence";
import { mergeDashboardLayout, getVisibleLayout } from "@/modules/dashboard/service/merge-dashboard-layout";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardAnyPermission(ctx, ["customers.read", "crm.read"]);

    await resetLayout({
      dealershipId: ctx.dealershipId,
      userId: ctx.userId,
    });

    const meta = getRequestMeta(request);
    await auditLog({
      dealershipId: ctx.dealershipId,
      actorUserId: ctx.userId,
      action: "dashboard_layout.reset",
      entity: "DashboardLayoutPreference",
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    });

    const effective = mergeDashboardLayout({
      permissions: ctx.permissions,
      savedLayoutRaw: null,
    });
    const visible = getVisibleLayout(effective);

    return jsonResponse({
      data: {
        ok: true,
        layout: visible.map((w) => ({ widgetId: w.widgetId, zone: w.zone, order: w.order, visible: w.visible })),
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
