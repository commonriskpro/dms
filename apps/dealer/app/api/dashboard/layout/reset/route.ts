import { NextRequest } from "next/server";
import {
  getAuthContext,
  handleApiError,
  jsonResponse,
  guardPermission,
  getRequestMeta,
} from "@/lib/api/handler";
import { checkRateLimit, incrementRateLimit } from "@/lib/api/rate-limit";
import { auditLog } from "@/lib/audit";
import { resetLayout } from "@/modules/dashboard/service/dashboard-layout-persistence";
import { mergeDashboardLayout, getVisibleLayout } from "@/modules/dashboard/service/merge-dashboard-layout";
import { invalidateDashboardLayoutCache } from "@/modules/dashboard/service/dashboard-layout-cache";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "dashboard.read");

    const rlKey = `dashboard_layout:${ctx.dealershipId}:${ctx.userId}`;
    if (!checkRateLimit(rlKey, "dashboard_layout_mutation")) {
      return Response.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests" } },
        { status: 429 }
      );
    }

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

    invalidateDashboardLayoutCache(ctx.dealershipId, ctx.userId);
    incrementRateLimit(rlKey, "dashboard_layout_mutation");

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
