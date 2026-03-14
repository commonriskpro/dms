import { NextRequest, NextResponse } from "next/server";
import { withApiLogging } from "@/lib/api/with-api-logging";
import * as healthService from "@/modules/core-platform/service/health";

/**
 * GET /api/health — Safe sanity check for deployments. No secrets in response.
 * Returns ok, app, version (Vercel commit SHA), time; optional db ping.
 * Response includes x-request-id for correlation. Wrapped with withApiLogging for structured request log.
 */
async function healthGet(
  request: NextRequest,
  _context: { params: Promise<Record<string, string>> }
): Promise<Response> {
  const result = await healthService.getHealthResponse();
  return NextResponse.json(result.body, { status: result.status });
}

export const GET = withApiLogging(healthGet);
