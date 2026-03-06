import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getAuthContext,
  handleApiError,
  jsonResponse,
  guardAnyPermission,
  getRequestMeta,
} from "@/lib/api/handler";
import { auditLog } from "@/lib/audit";
import { saveLayoutBodySchema, isPayloadWithinSizeLimit } from "@/modules/dashboard/schemas/dashboard-layout";
import { getWidgetById, filterByPermissions, WIDGET_REGISTRY } from "@/modules/dashboard/config/widget-registry";
import { saveLayout } from "@/modules/dashboard/service/dashboard-layout-persistence";
import { mergeDashboardLayout, getVisibleLayout } from "@/modules/dashboard/service/merge-dashboard-layout";

export const dynamic = "force-dynamic";

/** Filter payload to only allowed widget ids and valid zones; normalize order */
function filterPayloadToAllowed(
  payload: { version: 1; widgets: Array<{ widgetId: string; visible: boolean; zone: "topRow" | "main"; order: number }> },
  permissions: string[]
): { version: 1; widgets: typeof payload.widgets } {
  const allowed = filterByPermissions(WIDGET_REGISTRY, permissions);
  const allowedIds = new Set(allowed.map((w) => w.id));
  const filtered = payload.widgets.filter((p) => {
    if (!allowedIds.has(p.widgetId as never)) return false;
    const def = getWidgetById(p.widgetId);
    if (!def || !def.allowedZones.includes(p.zone)) return false;
    return true;
  });
  const byZone = { topRow: filtered.filter((p) => p.zone === "topRow"), main: filtered.filter((p) => p.zone === "main") };
  byZone.topRow.sort((a, b) => a.order - b.order);
  byZone.main.sort((a, b) => a.order - b.order);
  const normalized: typeof payload.widgets = [];
  byZone.topRow.forEach((p, i) => normalized.push({ ...p, order: i }));
  byZone.main.forEach((p, i) => normalized.push({ ...p, order: i }));
  return { version: 1, widgets: normalized };
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardAnyPermission(ctx, ["customers.read", "crm.read"]);

    const body = await request.json();
    const parsed = saveLayoutBodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.issues } },
        { status: 400 }
      );
    }
    const payload = filterPayloadToAllowed(parsed.data, ctx.permissions);
    if (!isPayloadWithinSizeLimit(payload)) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Payload too large" } },
        { status: 400 }
      );
    }

    await saveLayout({
      dealershipId: ctx.dealershipId,
      userId: ctx.userId,
      payload,
    });

    const meta = getRequestMeta(request);
    await auditLog({
      dealershipId: ctx.dealershipId,
      actorUserId: ctx.userId,
      action: "dashboard_layout.saved",
      entity: "DashboardLayoutPreference",
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    });

    const effective = mergeDashboardLayout({
      permissions: ctx.permissions,
      savedLayoutRaw: payload,
    });
    const visible = getVisibleLayout(effective);

    return jsonResponse({
      data: {
        ok: true,
        layout: visible.map((w) => ({ widgetId: w.widgetId, zone: w.zone, order: w.order, visible: w.visible })),
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Validation failed", details: e.issues } },
        { status: 400 }
      );
    }
    return handleApiError(e);
  }
}
