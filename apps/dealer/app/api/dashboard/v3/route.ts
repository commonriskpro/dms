import { NextRequest } from "next/server";
import { getAuthContext, guardPermission, handleApiError, jsonResponse } from "@/lib/api/handler";
import { logger } from "@/lib/logger";
import * as dashboardV3 from "@/modules/dashboard/service/getDashboardV3Data";

export const dynamic = "force-dynamic";

/** Detect non-JSON-safe values and return path + description for logging. */
function findNonSerializable(
  obj: unknown,
  path = "payload"
): { path: string; value: unknown; reason: string } | null {
  if (obj === null) return null;
  if (typeof obj === "bigint") {
    return { path, value: obj, reason: "BigInt" };
  }
  if (typeof obj === "undefined" || typeof obj === "symbol" || typeof obj === "function") {
    return { path, value: obj, reason: typeof obj };
  }
  if (typeof obj === "object") {
    if ("toFixed" in (obj as object) && typeof (obj as { toFixed: unknown }).toFixed === "function") {
      const d = obj as { toFixed: (digits?: number) => string };
      try {
        d.toFixed(0);
      } catch {
        return null;
      }
      return { path, value: obj, reason: "Decimal-like" };
    }
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        const r = findNonSerializable(obj[i], `${path}[${i}]`);
        if (r) return r;
      }
      return null;
    }
    for (const [k, v] of Object.entries(obj)) {
      const r = findNonSerializable(v, `${path}.${k}`);
      if (r) return r;
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    logger.info("dashboard_v3_route_entry", { route: "/api/dashboard/v3" });
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "dashboard.read");
    const data = await dashboardV3.getDashboardV3Data(
      ctx.dealershipId,
      ctx.userId,
      ctx.permissions
    );
    const payload = { data };

    if (process.env.NODE_ENV !== "production") {
      let serializationError: Error | null = null;
      try {
        JSON.stringify(payload);
      } catch (e) {
        serializationError = e instanceof Error ? e : new Error(String(e));
      }
      const bad = findNonSerializable(payload);
      if (serializationError || bad) {
        logger.error("dashboard_v3_serialization_failure", {
          route: "/api/dashboard/v3",
          errorMessage: serializationError?.message ?? null,
          offendingPath: bad?.path ?? null,
          offendingReason: bad?.reason ?? null,
          offendingValueType: bad ? typeof bad.value : null,
        });
      }
      if (bad) {
        throw new Error(
          `Dashboard v3 response contains non-JSON-serializable value at ${bad.path}: ${bad.reason}`
        );
      }
      if (serializationError) {
        throw serializationError;
      }
    }

    return jsonResponse(payload);
  } catch (e) {
    return handleApiError(e);
  }
}
