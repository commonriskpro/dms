import { NextResponse } from "next/server";
import { PlatformApiError } from "@/lib/platform-auth";
import { captureApiException, type CaptureApiExceptionOpts } from "@/lib/monitoring/sentry";

export function jsonResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function errorResponse(code: string, message: string, status: number, details?: unknown): NextResponse {
  return NextResponse.json(
    { error: { code, message, ...(details != null && { details }) } },
    { status }
  );
}

/** Optional context for Sentry when handling API errors. Safe tags only; no body/headers. */
export type SentryApiContext = Partial<
  Omit<CaptureApiExceptionOpts, "app">
>;

export function handlePlatformApiError(err: unknown, sentryContext?: SentryApiContext): NextResponse {
  captureApiException(err, { app: "platform", ...sentryContext });
  if (err instanceof PlatformApiError) {
    return errorResponse(err.code, err.message, err.status);
  }
  if (err instanceof Error) {
    if (err.name === "ZodError") {
      return errorResponse("VALIDATION_ERROR", "Validation failed", 422, err);
    }
  }
  const safeName = err instanceof Error ? err.name : "UnknownError";
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  console.error("[platform-api] Unexpected error", {
    name: safeName,
    message,
    ...(stack && { stack }),
  });
  return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
}
