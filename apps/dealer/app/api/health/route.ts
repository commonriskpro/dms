import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateEnv } from "@/lib/env";
import { withApiLogging } from "@/lib/api/with-api-logging";

/**
 * GET /api/health — Safe sanity check for deployments. No secrets in response.
 * Returns ok, app, version (Vercel commit SHA), time; optional db ping.
 * Response includes x-request-id for correlation. Wrapped with withApiLogging for structured request log.
 */
async function healthGet(
  request: NextRequest,
  _context: { params: Promise<Record<string, string>> }
): Promise<Response> {
  const envValidation = validateEnv();
  const base = {
    ok: envValidation.valid,
    app: "dealer" as const,
    version: process.env.VERCEL_GIT_COMMIT_SHA ?? undefined,
    time: new Date().toISOString(),
  };

  if (!envValidation.valid) {
    return NextResponse.json(
      {
        ...base,
        db: "skipped",
        message: `Missing required env: ${envValidation.missing.join(", ")}`,
        missingVars: envValidation.missing,
      },
      { status: 503 }
    );
  }
  try {
    await prisma.$queryRaw`SELECT 1 as ok`;
    return NextResponse.json({ ...base, db: "ok" });
  } catch {
    return NextResponse.json(
      { ...base, ok: false, db: "error", dbError: "Database health check failed" },
      { status: 503 }
    );
  }
}

export const GET = withApiLogging(healthGet);
