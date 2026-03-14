/**
 * Domains list/add (dealer). Verify/refresh-ssl endpoints trigger status checks; domain/SSL technical setup is platform-owned.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
  readSanitizedJson,
} from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";
import { ApiError } from "@/lib/auth";
import * as domainsService from "@/modules/websites-domains/service";
import * as siteService from "@/modules/websites-core/service/site";
import { serializeDomain } from "@/modules/websites-core/serialize";
import { addWebsiteDomainBodySchema } from "@/modules/websites-core/schemas";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "websites.read");
    const site = await siteService.getSite(ctx.dealershipId);
    if (!site) return jsonResponse({ data: [] });
    const domains = await domainsService.listDomains(ctx.dealershipId, site.id);
    return jsonResponse({ data: domains.map(serializeDomain) });
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json(validationErrorResponse(e.issues), { status: 400 });
    return handleApiError(e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "websites.write");
    const body = addWebsiteDomainBodySchema.parse(await readSanitizedJson(request));
    const site = await siteService.getSite(ctx.dealershipId);
    if (!site) throw new ApiError("NOT_FOUND", "Website site not found");
    const domain = await domainsService.addCustomDomain(
      ctx.dealershipId,
      site.id,
      body.hostname,
      body.isPrimary
    );
    return jsonResponse({ data: serializeDomain(domain) }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json(validationErrorResponse(e.issues), { status: 400 });
    return handleApiError(e);
  }
}
