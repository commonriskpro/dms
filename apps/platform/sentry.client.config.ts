/**
 * Sentry client (browser). No-op when NEXT_PUBLIC_SENTRY_DSN is unset.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.05 : 0.1,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.headers) {
        const headers = event.request.headers as Record<string, string>;
        if (headers["authorization"]) headers["authorization"] = "[REDACTED]";
        if (headers["cookie"]) headers["cookie"] = "[REDACTED]";
        if (headers["x-api-key"]) headers["x-api-key"] = "[REDACTED]";
      }
      if (event.request?.query_string) {
        const q = typeof event.request.query_string === "string" ? event.request.query_string : "";
        if (q && /token|code|invite|auth|key=/i.test(q)) {
          event.request.query_string = "[REDACTED]";
        }
      }
      return event;
    },
  });
}
