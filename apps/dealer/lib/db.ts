import { PrismaClient } from "@prisma/client";
import { getRequestContext } from "@/lib/request-context";
import { logger } from "@/lib/logger";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const SLOW_QUERY_MS = parseInt(process.env.SLOW_QUERY_THRESHOLD_MS ?? "2000", 10) || 2000;

function getDatabaseUrl(): string | undefined {
  const useTestDatabase =
    process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID != null;
  const url = useTestDatabase
    ? process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
    : process.env.DATABASE_URL;
  if (!url) return undefined;
  if (useTestDatabase && process.env.TEST_DATABASE_URL && !url.includes("connection_limit=")) {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}connection_limit=1`;
  }
  return url;
}

function createPrisma(): PrismaClient {
  const datasourceUrl = getDatabaseUrl();
  const client = new PrismaClient({
    ...(datasourceUrl ? { datasourceUrl } : {}),
    log: [
      "error",
      ...(process.env.NODE_ENV === "development" ? (["warn"] as const) : []),
      { emit: "event", level: "query" },
    ],
  });
  (client as unknown as { $on: (event: string, cb: (e: { duration?: number; query?: string }) => void) => void }).$on(
    "query",
    (e: { duration?: number; query?: string }) => {
      const duration = e.duration ?? 0;
      if (duration >= SLOW_QUERY_MS) {
        const queryPreview =
          typeof e.query === "string"
            ? e.query.slice(0, 80).replace(/\s+/g, " ").replace(/\$\d+/g, "?")
            : "?";
        const requestContext = getRequestContext();
        logger.warn("slow-query", {
          requestId: requestContext?.requestId ?? null,
          route: requestContext?.route ?? null,
          method: requestContext?.method ?? null,
          dealershipId: requestContext?.dealershipId ?? null,
          queryLabel: requestContext?.queryLabel ?? null,
          durationMs: duration,
          thresholdMs: SLOW_QUERY_MS,
          queryPreview: `${queryPreview}…`,
        });
      }
    }
  );
  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
