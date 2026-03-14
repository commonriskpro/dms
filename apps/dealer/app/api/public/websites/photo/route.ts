/**
 * Public endpoint — no authentication required.
 * Returns 302 redirect to a short-lived signed URL for a vehicle photo.
 * Hostname and fileId are required; file must belong to a published vehicle for the resolved site.
 */
import { NextRequest } from "next/server";
import { getRequestMeta } from "@/lib/api/handler";
import { getPublicPhotoSignedUrl } from "@/modules/websites-public/service";
import { applyRateLimit } from "@/lib/infrastructure/rate-limit/rateLimit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rl = applyRateLimit(request, { type: "website_photo", keyStrategy: "ip" });
  if (!rl.allowed) {
    const retryAfterSec = Math.ceil(rl.retryAfterMs / 1000);
    return new Response(null, {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    });
  }

  const fileId = request.nextUrl.searchParams.get("fileId");
  const hostname = request.nextUrl.searchParams.get("hostname");

  if (!fileId || !hostname) {
    return Response.json(
      { error: { code: "VALIDATION_ERROR", message: "fileId and hostname are required" } },
      { status: 400 }
    );
  }

  const meta = getRequestMeta(request);
  const result = await getPublicPhotoSignedUrl(hostname, fileId, meta);

  if (!result) {
    return Response.json(
      { error: { code: "NOT_FOUND", message: "Photo not found or not available for this site" } },
      { status: 404 }
    );
  }

  return new Response(null, {
    status: 302,
    headers: { Location: result.url },
  });
}
