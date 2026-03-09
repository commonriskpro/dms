import { NextRequest } from "next/server";
import { InternalApiError, verifyInternalApiJwt } from "@/lib/internal-api-auth";
import { checkInternalRateLimit } from "@/lib/internal-rate-limit";

export function internalJobError(code: string, message: string, status: number, details?: unknown) {
  return Response.json(
    details != null ? { error: { code, message, details } } : { error: { code, message } },
    { status }
  );
}

export async function authorizeInternalJobRequest(request: NextRequest): Promise<Response | null> {
  const rateLimitRes = await checkInternalRateLimit(request);
  if (rateLimitRes) return rateLimitRes;

  try {
    await verifyInternalApiJwt(request.headers.get("authorization"));
  } catch (error) {
    if (error instanceof InternalApiError) {
      return internalJobError(error.code, error.message, error.status);
    }
    throw error;
  }

  return null;
}
