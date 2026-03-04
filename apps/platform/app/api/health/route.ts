import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateEnv } from "@/lib/env";
import { getOrCreateRequestId } from "@/lib/request-id";

const REQUEST_ID_HEADER = "x-request-id";

/**
 * GET /api/health — Safe sanity check for deployments. No secrets in response.
 * Returns ok, app, version (Vercel commit SHA), time; optional db ping.
 * Response includes x-request-id for correlation.
 */
export async function GET(request: NextRequest) {
  const requestId = getOrCreateRequestId(request.headers.get(REQUEST_ID_HEADER));
  const envValidation = validateEnv();
  const base = {
    ok: envValidation.valid,
    app: "platform" as const,
    version: process.env.VERCEL_GIT_COMMIT_SHA ?? undefined,
    time: new Date().toISOString(),
  };

  let res: NextResponse;
  if (!envValidation.valid) {
    res = NextResponse.json(
      {
        ...base,
        db: "skipped",
        message: `Missing required env: ${envValidation.missing.join(", ")}`,
        missingVars: envValidation.missing,
      },
      { status: 503 }
    );
  } else {
    try {
      await prisma.$queryRaw`SELECT 1 as ok`;
      res = NextResponse.json({ ...base, db: "ok" });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      res = NextResponse.json(
        { ...base, ok: false, db: "error", dbError: message },
        { status: 503 }
      );
    }
  }
  res.headers.set(REQUEST_ID_HEADER, requestId);
  return res;
}
