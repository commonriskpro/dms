/**
 * Public endpoint — no authentication required.
 * Accepts lead form submissions from the public dealer website.
 *
 * Security:
 * - Rate-limited: 5 submissions/min per IP (website_lead type)
 * - Honeypot field validated by service layer
 * - Zod validation enforced before any DB access
 * - Tenant resolved internally from site + dealershipId stored in DB
 * - No PII logged
 */
import { NextRequest } from "next/server";
import { jsonResponse, handleApiError } from "@/lib/api/handler";
import { submitLead } from "@/modules/websites-leads/service";
import { websiteLeadSubmissionSchema } from "@dms/contracts";
import { prisma } from "@/lib/db";
import { applyRateLimit } from "@/lib/infrastructure/rate-limit/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Rate-limit first — before any DB access
  const rl = applyRateLimit(request, { type: "website_lead", keyStrategy: "ip" });
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

    // Resolve site from hostname — fails closed if not published
    const domain = await prisma.websiteDomain.findFirst({
      where: {
        hostname: hostname.toLowerCase().replace(/:\d+$/, "").replace(/\.+$/, "").replace(/^www\./, ""),
      },
      include: {
        site: { select: { id: true, dealershipId: true, publishedReleaseId: true, deletedAt: true } },
      },
    });

    if (!domain?.site || !domain.site.publishedReleaseId || domain.site.deletedAt) {
      return jsonResponse({ error: { code: "NOT_FOUND", message: "No active website for this hostname" } }, 404);
    }

    const { id: siteId, dealershipId } = domain.site;

    const result = await submitLead({
      dealershipId,
      siteId,
      submission: parsed.data,
    });

    return jsonResponse({ ok: result.ok });
  } catch (e) {
    return handleApiError(e);
  }
}
