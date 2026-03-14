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
import * as domainsService from "@/modules/websites-domains/service";
import { serializeDomain } from "@/modules/websites-core/serialize";
import { domainIdParamSchema, updateWebsiteDomainBodySchema } from "@/modules/websites-core/schemas";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ domainId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "websites.write");
    const { domainId } = domainIdParamSchema.parse(await params);
    const body = updateWebsiteDomainBodySchema.parse(await readSanitizedJson(request));
    const updated = await domainsService.updateDomain(ctx.dealershipId, domainId, {
      ...(body.isPrimary !== undefined && { isPrimary: body.isPrimary }),
      ...(body.verificationStatus !== undefined && { verificationStatus: body.verificationStatus }),
      ...(body.sslStatus !== undefined && { sslStatus: body.sslStatus }),
    });
    return jsonResponse({ data: serializeDomain(updated) });
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json(validationErrorResponse(e.issues), { status: 400 });
    return handleApiError(e);
  }
}
