import * as healthDb from "../db/health";
import { validateEnv } from "@/lib/env";

type HealthResponseBody = {
  ok: boolean;
  app: "dealer";
  version?: string;
  time: string;
  db: "ok" | "error" | "skipped";
  message?: string;
  missingVars?: string[];
  dbError?: string;
};

export async function getHealthResponse(): Promise<{ status: number; body: HealthResponseBody }> {
  const envValidation = validateEnv();
  const base = {
    ok: envValidation.valid,
    app: "dealer" as const,
    version: process.env.VERCEL_GIT_COMMIT_SHA ?? undefined,
    time: new Date().toISOString(),
  };

  if (!envValidation.valid) {
    return {
      status: 503,
      body: {
        ...base,
        db: "skipped",
        message: `Missing required env: ${envValidation.missing.join(", ")}`,
        missingVars: envValidation.missing,
      },
    };
  }

  try {
    await healthDb.pingDatabase();
    return { status: 200, body: { ...base, db: "ok" } };
  } catch {
    return {
      status: 503,
      body: { ...base, ok: false, db: "error", dbError: "Database health check failed" },
    };
  }
}
