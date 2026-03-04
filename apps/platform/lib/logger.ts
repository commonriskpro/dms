/**
 * Structured JSON logger for platform. Safe for Vercel logs; no PII.
 */

import { redact } from "./redact";

const APP = "platform";
const ENV = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";

export type LogContext = {
  requestId?: string | null;
  route?: string | null;
  method?: string | null;
  status?: number | null;
  durationMs?: number | null;
  /** Platform app: UUID of the authenticated platform user. */
  actorPlatformUserId?: string | null;
  platformUserId?: string | null;
  errorCode?: string | null;
  errorName?: string | null;
  [key: string]: unknown;
};

function serialize(context: LogContext): Record<string, unknown> {
  const out: Record<string, unknown> = {
    ts: new Date().toISOString(),
    app: APP,
    env: ENV,
    ...context,
  };
  return redact(out) as Record<string, unknown>;
}

function write(level: string, msg: string, context: LogContext = {}): void {
  const obj = serialize({ ...context, msg });
  const line = JSON.stringify({ level, ...obj });
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info: (msg: string, context?: LogContext) => write("info", msg, context ?? {}),
  warn: (msg: string, context?: LogContext) => write("warn", msg, context ?? {}),
  error: (msg: string, context?: LogContext) => write("error", msg, context ?? {}),
  debug: (msg: string, context?: LogContext) => write("debug", msg, context ?? {}),
};
