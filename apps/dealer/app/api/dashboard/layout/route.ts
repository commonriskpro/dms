import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getAuthContext,
  handleApiError,
  jsonResponse,
  guardPermission,
  getRequestMeta,
  readSanitizedJson,
} from "@/lib/api/handler";
import { checkRateLimit, incrementRateLimit } from "@/lib/api/rate-limit";
import { auditLog } from "@/lib/audit";
import {
  saveLayoutBodySchema,
  isPayloadWithinSizeLimit,
  normalizeDashboardLayout,
  computeDashboardLayoutChecksum,
  type DashboardLayoutPayload,
  type WidgetPlacement,
} from "@/modules/dashboard/schemas/dashboard-layout";
import { getWidgetById, filterByPermissions, WIDGET_REGISTRY } from "@/modules/dashboard/config/widget-registry";
import { saveLayout } from "@/modules/dashboard/service/dashboard-layout-persistence";
import { mergeDashboardLayout, getVisibleLayout } from "@/modules/dashboard/service/merge-dashboard-layout";
import { invalidateDashboardLayoutCache } from "@/modules/dashboard/service/dashboard-layout-cache";

export const dynamic = "force-dynamic";

/** Filter payload to allowed widget ids and valid zones; add widgetVersion from registry; return payload suitable for normalize. */
function filterAndEnrichPayload(
  payload: { version: 1; widgets: WidgetPlacement[] },
  permissions: string[]
): DashboardLayoutPayload {
  const allowed = filterByPermissions(WIDGET_REGISTRY, permissions);
  const allowedIds = new Set(allowed.map((w) => w.id));
  const filtered = payload.widgets.filter((p) => {
    if (!allowedIds.has(p.widgetId as never)) return false;
    const def = getWidgetById(p.widgetId);
    if (!def || !def.allowedZones.includes(p.zone)) return false;
    return true;
  });
  const enriched: WidgetPlacement[] = filtered.map((p) => {
    const def = getWidgetById(p.widgetId);
    return {
      ...p,
      widgetVersion: def?.version ?? 1,
    };
  });
  const byZone = { topRow: enriched.filter((p) => p.zone === "topRow"), main: enriched.filter((p) => p.zone === "main") };
  byZone.topRow.sort((a, b) => a.order - b.order);
  byZone.main.sort((a, b) => a.order - b.order);
  const ordered: WidgetPlacement[] = [];
  byZone.topRow.forEach((p, i) => ordered.push({ ...p, order: i }));
  byZone.main.forEach((p, i) => ordered.push({ ...p, order: i }));
  return normalizeDashboardLayout({ version: 1, widgets: ordered });
}

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

    const body = await readSanitizedJson(request);
    const parsed = saveLayoutBodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Validation failed", details: parsed.error.issues } },
        { status: 400 }
      );
    }
    const normalizedPayload = filterAndEnrichPayload(parsed.data, ctx.permissions);
    if (!isPayloadWithinSizeLimit(normalizedPayload)) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Payload too large" } },
        { status: 400 }
      );
    }
    const checksum = computeDashboardLayoutChecksum(normalizedPayload);

    const wrote = await saveLayout({
      dealershipId: ctx.dealershipId,
      userId: ctx.userId,
      payload: normalizedPayload,
      checksum,
    });

    if (wrote) {
      const meta = getRequestMeta(request);
      await auditLog({
        dealershipId: ctx.dealershipId,
        actorUserId: ctx.userId,
        action: "dashboard_layout.saved",
        entity: "DashboardLayoutPreference",
        ip: meta.ip ?? null,
        userAgent: meta.userAgent ?? null,
      });
    }

    invalidateDashboardLayoutCache(ctx.dealershipId, ctx.userId);
    incrementRateLimit(rlKey, "dashboard_layout_mutation");

    const effective = mergeDashboardLayout({
      permissions: ctx.permissions,
      savedLayoutRaw: normalizedPayload,
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
