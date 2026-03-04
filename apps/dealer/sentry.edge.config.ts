/**
 * Sentry Edge runtime. No-op when SENTRY_DSN is unset.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.05 : 0.1,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.headers) {
        const h = event.request.headers as Record<string, string>;
        if (h["authorization"]) h["authorization"] = "[REDACTED]";
        if (h["cookie"]) h["cookie"] = "[REDACTED]";
      }
      return event;
    },
  });
}
