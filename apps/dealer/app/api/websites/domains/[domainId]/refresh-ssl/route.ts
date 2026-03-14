import { NextRequest } from "next/server";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";
import * as domainsService from "@/modules/websites-domains/service";
import { serializeDomain } from "@/modules/websites-core/serialize";
import { domainIdParamSchema } from "@/modules/websites-core/schemas";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * POST /api/websites/domains/[domainId]/refresh-ssl — refresh SSL status.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ domainId: string }> }
) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "websites.write");
    const { domainId } = domainIdParamSchema.parse(await params);

    const updated = await domainsService.refreshDomainSsl(ctx.dealershipId, domainId);
    return jsonResponse({ data: serializeDomain(updated) });
  } catch (e) {
    if (e instanceof z.ZodError) return Response.json(validationErrorResponse(e.issues), { status: 400 });
    return handleApiError(e);
  }
}
