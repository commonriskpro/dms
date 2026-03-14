import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getAuthContext,
  getRequestMeta,
  guardPermission,
  handleApiError,
  jsonResponse,
  readSanitizedJson,
} from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";
import * as siteService from "@/modules/websites-core/service/site";
import { serializeSite } from "@/modules/websites-core/serialize";
import {
  createWebsiteSiteBodySchema,
  updateWebsiteSiteBodySchema,
  websiteThemeConfigSchema,
  websiteContactConfigSchema,
  websiteSocialConfigSchema,
} from "@/modules/websites-core/schemas";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "websites.read");
    const site = await siteService.getSite(ctx.dealershipId);
    if (!site) return jsonResponse({ data: null });
    return jsonResponse({ data: serializeSite(site) });
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json(validationErrorResponse(e.issues), { status: 400 });
    return handleApiError(e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "websites.write");
    const body = createWebsiteSiteBodySchema.parse(await readSanitizedJson(request));
    const meta = getRequestMeta(request);
    const site = await siteService.initializeSite(ctx.dealershipId, ctx.userId, body, meta);
    return jsonResponse({ data: serializeSite(site!) }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json(validationErrorResponse(e.issues), { status: 400 });
    return handleApiError(e);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "websites.write");
    const body = updateWebsiteSiteBodySchema.parse(await readSanitizedJson(request));
    const meta = getRequestMeta(request);

    const update: Parameters<typeof siteService.updateSite>[2] = {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.activeTemplateKey !== undefined && { activeTemplateKey: body.activeTemplateKey }),
      ...(body.themeConfig !== undefined && {
        themeConfigJson: websiteThemeConfigSchema.parse(body.themeConfig) as object,
      }),
      ...(body.contactConfig !== undefined && {
        contactConfigJson: websiteContactConfigSchema.parse(body.contactConfig) as object,
      }),
      ...(body.socialConfig !== undefined && {
        socialConfigJson: websiteSocialConfigSchema.parse(body.socialConfig) as object,
      }),
    };

    const updated = await siteService.updateSite(ctx.dealershipId, ctx.userId, update, meta);
    return jsonResponse({ data: serializeSite(updated) });
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json(validationErrorResponse(e.issues), { status: 400 });
    return handleApiError(e);
  }
}
