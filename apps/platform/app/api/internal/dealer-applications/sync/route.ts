import { NextRequest } from "next/server";
import { errorResponse, jsonResponse, handlePlatformApiError } from "@/lib/api-handler";
import { verifyInternalApiJwt, InternalApiError } from "@/lib/internal-api-auth";
import { syncDealerApplicationFromDealer } from "@/lib/dealer-applications";
import { dealerApplicationSyncPayloadSchema } from "@dms/contracts";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await verifyInternalApiJwt(request.headers.get("authorization"));
  } catch (error) {
    if (error instanceof InternalApiError) {
      return errorResponse(error.code, error.message, error.status);
    }
    throw error;
  }

  try {
    const body = await request.json();
    const payload = dealerApplicationSyncPayloadSchema.parse(body);
    const synced = await syncDealerApplicationFromDealer(payload);
    return jsonResponse(synced, 201);
  } catch (error) {
    return handlePlatformApiError(error);
  }
}
