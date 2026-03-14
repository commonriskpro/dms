/**
 * Public endpoint — no authentication required.
 * Tenant is resolved exclusively from the `hostname` query param.
 * Client-supplied dealershipId is NEVER accepted; all tenant resolution
 * is authoritative via the hostname → WebsiteDomain → WebsiteSite lookup.
 *
 * Called server-to-server from apps/websites SSR — never directly by browsers.
 */
import { NextRequest } from "next/server";
import { jsonResponse, handleApiError } from "@/lib/api/handler";
import { resolveSiteByHostname } from "@/modules/websites-domains/service";
import { listPublicVehicles } from "@/modules/websites-public/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams;

    const hostname = q.get("hostname");
    if (!hostname) {
      return jsonResponse({ error: { code: "VALIDATION_ERROR", message: "hostname is required" } }, 400);
    }

    // Resolve site from hostname — fails closed if not published
    const resolved = await resolveSiteByHostname(hostname);
    if (!resolved) {
      return jsonResponse({ error: { code: "NOT_FOUND", message: "No published site for this hostname" } }, 404);
    }

    const { site } = resolved;
    const dealershipId = site.dealershipId;

    const page = Math.max(1, parseInt(q.get("page") ?? "1", 10));
    const limit = Math.min(Math.max(1, parseInt(q.get("limit") ?? "24", 10)), 48);
    const make = q.get("make") ?? undefined;
    const model = q.get("model") ?? undefined;
    const yearRaw = q.get("year");
    const year = yearRaw ? parseInt(yearRaw, 10) : undefined;

    const result = await listPublicVehicles(dealershipId, { page, limit, make, model, year });
    return jsonResponse(result);
  } catch (e) {
    return handleApiError(e);
  }
}
