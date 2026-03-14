/**
 * Public endpoint — no authentication required.
 * Accepts lead form submissions from the public dealer website.
 *
 * Security:
 * - Rate-limited: 5 submissions/min per IP (website_lead type); Redis-backed when REDIS_URL set
 * - Honeypot field validated by service layer
 * - Zod validation enforced before any DB access
 * - Tenant resolved internally from site + dealershipId stored in DB
 * - No PII logged
 */
import { NextRequest } from "next/server";
import { jsonResponse, handleApiError } from "@/lib/api/handler";
import { submitLead } from "@/modules/websites-leads/service";
import { resolvePublishedSiteByHostname } from "@/modules/websites-public/service";
import { websiteLeadSubmissionSchema } from "@dms/contracts";
import {
  checkAndIncrementWebsiteLeadRateLimit,
  getClientIdentifier,
} from "@/lib/infrastructure/rate-limit/redisRateLimit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Rate-limit first — before any DB access (Redis-backed when available)
  const identifier = getClientIdentifier(request);
  const rl = await checkAndIncrementWebsiteLeadRateLimit(identifier);
  if (!rl.allowed) {
    const retryAfterSec = Math.ceil(rl.retryAfterMs / 1000);
    return Response.json(
      { error: { code: "RATE_LIMITED", message: "Too many requests. Please wait before submitting again." } },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;

    const parsed = websiteLeadSubmissionSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(
        { error: { code: "VALIDATION_ERROR", message: "Invalid form submission", details: parsed.error.issues } },
        400
      );
    }

    // Resolve the site from hostname (authoritative, not client-supplied)
    const hostname = body.hostname as string | undefined;
    if (!hostname || typeof hostname !== "string") {
      return jsonResponse({ error: { code: "VALIDATION_ERROR", message: "hostname is required" } }, 400);
    }

    const site = await resolvePublishedSiteByHostname(hostname);
    if (!site) {
      return jsonResponse({ error: { code: "NOT_FOUND", message: "No active website for this hostname" } }, 404);
    }

    const result = await submitLead({
      dealershipId: site.dealershipId,
      siteId: site.siteId,
      submission: parsed.data,
    });

    return jsonResponse({ ok: result.ok });
  } catch (e) {
    return handleApiError(e);
  }
}
