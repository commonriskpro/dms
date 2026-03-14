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
import { getPublicVehicleBySlug } from "@/modules/websites-public/service";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const hostname = request.nextUrl.searchParams.get("hostname");
    if (!hostname) {
      return jsonResponse({ error: { code: "VALIDATION_ERROR", message: "hostname is required" } }, 400);
    }

    // Resolve site from hostname — fails closed if not published
    const resolved = await resolveSiteByHostname(hostname);
    if (!resolved) {
      return jsonResponse({ error: { code: "NOT_FOUND", message: "No published site for this hostname" } }, 404);
    }

    const vehicle = await getPublicVehicleBySlug(resolved.site.dealershipId, slug);
    if (!vehicle) {
      return jsonResponse({ error: { code: "NOT_FOUND", message: "Vehicle not found" } }, 404);
    }
    return jsonResponse({ vehicle });
  } catch (e) {
    return handleApiError(e);
  }
}
