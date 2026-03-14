import { NextRequest } from "next/server";
import { requirePlatformAuth, requirePlatformRole } from "@/lib/platform-auth";
import { handlePlatformApiError, jsonResponse } from "@/lib/api-handler";
import { listPlatformDealerApplications } from "@/lib/dealer-applications";
import { dealerApplicationListQuerySchema } from "@dms/contracts";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requirePlatformAuth();
    await requirePlatformRole(user, [
      "PLATFORM_OWNER",
      "PLATFORM_COMPLIANCE",
      "PLATFORM_SUPPORT",
    ]);
    const { searchParams } = new URL(request.url);
    const query = dealerApplicationListQuerySchema.parse({
      limit: searchParams.get("limit") ?? undefined,
      offset: searchParams.get("offset") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      source: searchParams.get("source") ?? undefined,
    });
    const result = await listPlatformDealerApplications(query);
    return jsonResponse(result);
  } catch (e) {
    return handlePlatformApiError(e);
  }
}
