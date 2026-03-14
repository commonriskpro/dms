/**
 * Public endpoint — no authentication. Ingest page view / VDP view events.
 * Rate-limited; tenant resolved from hostname only.
 */
import { NextRequest } from "next/server";
import { jsonResponse, handleApiError } from "@/lib/api/handler";
import { recordPageView } from "@/modules/websites-public/analytics";
import { applyRateLimit } from "@/lib/infrastructure/rate-limit/rateLimit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const eventBodySchema = z.object({
  hostname: z.string().min(1).max(253),
  eventType: z.enum(["page_view", "vdp_view"]),
  path: z.string().max(500),
  vehicleSlug: z.string().max(200).optional().nullable(),
  utmSource: z.string().max(200).optional().nullable(),
  utmMedium: z.string().max(200).optional().nullable(),
  utmCampaign: z.string().max(200).optional().nullable(),
  referrer: z.string().max(2000).optional().nullable(),
});

export async function POST(request: NextRequest) {
  const rl = applyRateLimit(request, { type: "website_events", keyStrategy: "ip" });
  if (!rl.allowed) {
    const retryAfterSec = Math.ceil(rl.retryAfterMs / 1000);
    return new Response(null, {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    });
  }

  try {
    const body = await request.json();
    const parsed = eventBodySchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(
        { error: { code: "VALIDATION_ERROR", message: "Invalid event payload", details: parsed.error.issues } },
        400
      );
    }

    const ok = await recordPageView(parsed.data);
    return jsonResponse({ ok });
  } catch (e) {
    return handleApiError(e);
  }
}
