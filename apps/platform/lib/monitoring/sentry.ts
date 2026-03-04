/**
 * Optional Sentry server init and safe API exception capture for platform app.
 * No-op when SENTRY_DSN is unset. Do not require Sentry in tests.
 */
import * as Sentry from "@sentry/nextjs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string | undefined): boolean {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * Initialize Sentry server only when SENTRY_DSN is set.
 * Release: VERCEL_GIT_COMMIT_SHA || NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || "dev"
 * Environment: VERCEL_ENV || NODE_ENV
 */
export function initServerSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  const release =
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
    "dev";
  const environment =
    process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";

  Sentry.init({
    dsn,
    release,
    environment,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.05 : 0.1,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request) {
        if (event.request.headers) {
          const h = event.request.headers as Record<string, string>;
          if (h["authorization"]) h["authorization"] = "[REDACTED]";
          if (h["cookie"]) h["cookie"] = "[REDACTED]";
          if (h["x-api-key"]) h["x-api-key"] = "[REDACTED]";
        }
        const qs = event.request.query_string;
        const qsStr = typeof qs === "string" ? qs : "";
        if (qsStr && /token|code|invite|auth|key=/i.test(qsStr)) {
          event.request.query_string = "[REDACTED]";
        }
      }
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((b) => {
          if (b.data?.url && typeof b.data.url === "string" && /token|code=|invite=|key=/i.test(b.data.url)) {
            return { ...b, data: { ...b.data, url: "[REDACTED]" } };
          }
          return b;
        });
      }
      return event;
    },
  });
}

export type CaptureApiExceptionOpts = {
  app: string;
  requestId?: string;
  route?: string;
  method?: string;
  platformUserId?: string;
  dealershipId?: string;
};

/**
 * Capture exception to Sentry only when DSN is configured.
 * Sets only safe tags (requestId, app, route, method, platformUserId, dealershipId).
 * Never attaches request body or headers.
 */
export function captureApiException(err: unknown, opts: CaptureApiExceptionOpts): void {
  if (!process.env.SENTRY_DSN) return;

  Sentry.withScope((scope) => {
    if (opts.requestId != null && opts.requestId !== "") scope.setTag("requestId", opts.requestId);
    scope.setTag("app", opts.app);
    if (opts.route != null && opts.route !== "") scope.setTag("route", opts.route);
    if (opts.method != null && opts.method !== "") scope.setTag("method", opts.method);
    if (isUuid(opts.platformUserId)) scope.setTag("platformUserId", opts.platformUserId!);
    if (isUuid(opts.dealershipId)) scope.setTag("dealershipId", opts.dealershipId!);
    Sentry.captureException(err);
  });
}
