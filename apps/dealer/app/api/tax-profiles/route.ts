import { NextRequest } from "next/server";
import {
  getAuthContext,
  guardPermission,
  handleApiError,
  jsonResponse,
} from "@/lib/api/handler";
import * as taxService from "@/modules/accounting-core/service/tax";

export const dynamic = "force-dynamic";

function serializeTaxProfile(profile: {
  id: string;
  name: string;
  state: string | null;
  county: string | null;
  city: string | null;
  taxRateBps: number;
  docFeeTaxable: boolean;
  warrantyTaxable: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: profile.id,
    name: profile.name,
    state: profile.state,
    county: profile.county,
    city: profile.city,
    taxRateBps: profile.taxRateBps,
    docFeeTaxable: profile.docFeeTaxable,
    warrantyTaxable: profile.warrantyTaxable,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthContext(request);
    await guardPermission(ctx, "finance.submissions.read");
    const list = await taxService.listTaxProfiles(ctx.dealershipId);
    return jsonResponse({ data: list.map(serializeTaxProfile) });
  } catch (e) {
    return handleApiError(e);
  }
}
