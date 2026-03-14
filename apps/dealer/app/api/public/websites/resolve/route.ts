/**
 * Public endpoint — no authentication required.
 * Resolves a published site context by hostname for the public websites runtime.
 */
import { NextRequest } from "next/server";
import { jsonResponse, handleApiError } from "@/lib/api/handler";
import { resolvePublishedSiteByHostname } from "@/modules/websites-public/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const hostname = request.nextUrl.searchParams.get("hostname");
    if (!hostname) {
      return jsonResponse({ error: { code: "VALIDATION_ERROR", message: "hostname is required" } }, 400);
    }
    const context = await resolvePublishedSiteByHostname(hostname);
    if (!context) {
      return jsonResponse({ error: { code: "NOT_FOUND", message: "No published site for this hostname" } }, 404);
    }
    return jsonResponse({ context });
  } catch (e) {
    return handleApiError(e);
  }
}
