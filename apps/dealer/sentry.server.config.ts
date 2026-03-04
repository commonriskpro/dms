/**
 * Sentry server. No-op when SENTRY_DSN is unset.
 * Uses shared release/environment logic from lib/monitoring/sentry.
 */
import { initServerSentry } from "./lib/monitoring/sentry";

initServerSentry();
