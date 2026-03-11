import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getAuthContext,
  guardAnyPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";
import { validationErrorResponse } from "@/lib/api/validate";
import {
  listSignalsForDealership,
  type SignalDomain,
} from "@/modules/intelligence/service/signal-engine";
import { listSignalsQuerySchema } from "../schemas";
import { getQueryObject } from "@/lib/api/query";
import { listPayload } from "@/lib/api/list-response";

export const dynamic = "force-dynamic";

const INTELLIGENCE_READ_PERMISSIONS = [
  "inventory.read",
  "inventory.acquisition.read",
  "crm.read",
  "customers.read",
  "deals.read",
] as const;

const DOMAIN_PERMISSION_MAP: Record<SignalDomain, string[]> = {
  inventory: ["inventory.read"],
  crm: ["crm.read", "customers.read"],
  deals: ["deals.read"],
  operations: ["deals.read"],
  acquisition: ["inventory.acquisition.read", "inventory.read"],
};

async function guardDomainPermission(
  ctx: Awaited<ReturnType<typeof getAuthContext>>,
  domain: SignalDomain | undefined
): Promise<void> {
  if (!domain) {
    await guardAnyPermission(ctx, [...INTELLIGENCE_READ_PERMISSIONS]);
    return;
  }
  await guardAnyPermission(ctx, DOMAIN_PERMISSION_MAP[domain]);
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    const query = listSignalsQuerySchema.parse(getQueryObject(request));

    await guardDomainPermission(ctx, query.domain);

    const { data, total } = await listSignalsForDealership(ctx.dealershipId, {
      domain: query.domain,
      severity: query.severity,
      includeResolved: query.includeResolved,
      limit: query.limit,
      offset: query.offset,
    });

    return jsonResponse(listPayload(data, total, query.limit, query.offset));
  } catch (e) {
    if (e instanceof z.ZodError) {
      return Response.json(validationErrorResponse(e.issues), { status: 400 });
    }
    return handleApiError(e);
  }
}
