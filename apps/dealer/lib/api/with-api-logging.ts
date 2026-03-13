/**
 * API logging wrapper for dealer /api/* and /api/internal/* routes.
 * - Reads or generates request ID (X-Request-Id); sets it on the response.
 * - Logs one JSON line per request: ts, level, app, env, requestId, route, method, status, durationMs, dealershipId?.
 * - Use: export const GET = withApiLogging(async (req, ctx) => { ... });
 */

import { NextRequest } from "next/server";
import { getOrCreateRequestId, addRequestIdToResponse } from "@/lib/request-id";
import { runWithRequestContext, setRequestContext } from "@/lib/request-context";
import { logger } from "@/lib/logger";

const REQUEST_ID_HEADER = "x-request-id";

/** Compatible with Next.js RouteContext so GET/POST exports pass next build type check. */
export type ApiLoggingContext = { params: Promise<Record<string, string>> };

export type ApiHandler = (
  request: NextRequest,
  context: ApiLoggingContext
) => Promise<Response>;

/**
 * Wraps an API route handler to: get or create requestId, measure duration,
 * log one structured line after the handler, and set X-Request-Id on the response.
 * dealershipId is not set by the wrapper; handlers that need it in logs can log separately.
 */
export function withApiLogging(handler: ApiHandler): ApiHandler {
  return async function wrapped(
    request: NextRequest,
    context: ApiLoggingContext
  ): Promise<Response> {
    const requestId = getOrCreateRequestId(request.headers.get(REQUEST_ID_HEADER));
    const start = Date.now();
    const route = request.nextUrl?.pathname ?? request.url ?? null;
    return runWithRequestContext(
      {
        requestId,
        route,
        method: request.method,
      },
      async () => {
        setRequestContext({ requestId, route, method: request.method });
        let response: Response;
        try {
          response = await handler(request, context);
        } catch (err) {
          const durationMs = Date.now() - start;
          logger.error("request", {
            requestId,
            route,
            method: request.method,
            status: null,
            durationMs,
            errorName: err instanceof Error ? err.name : undefined,
          });
          throw err;
        }

        const durationMs = Date.now() - start;
        const status = response.status;
        logger.info("request", {
          requestId,
          route,
          method: request.method,
          status,
          durationMs,
        });

        return addRequestIdToResponse(response, requestId);
      }
    );
  };
}
