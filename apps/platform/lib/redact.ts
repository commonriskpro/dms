/**
 * Redaction for logs and Sentry. Never log or send PII/tokens.
 */

const REDACT_KEYS = new Set([
  "authorization",
  "cookie",
  "cookies",
  "x-api-key",
  "token",
  "access_token",
  "refresh_token",
  "id_token",
  "code",
  "invite",
  "invite_token",
  "auth",
  "key",
  "email",
  "accepturl",
  "accept_url",
  "vin",
  "ssn",
  "socialsecuritynumber",
  "dob",
  "dateofbirth",
  "income",
  "phone",
  "password",
  "secret",
  "database_url",
  "databaseurl",
  "supabase",
]);

const REDACT_PLACEHOLDER = "[REDACTED]";

function keyMatches(key: string): boolean {
  return REDACT_KEYS.has(key.toLowerCase().replace(/[-_]/g, ""));
}

/**
 * Recursively redact known sensitive keys from an object. In place; returns the same object.
 */
export function redact<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      if (item !== null && typeof item === "object" && !(item instanceof Date)) {
        (obj as unknown[])[i] = redact(item);
      }
    });
    return obj;
  }
  const record = obj as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (keyMatches(key)) {
      record[key] = REDACT_PLACEHOLDER as unknown;
    } else if (
      record[key] !== null &&
      typeof record[key] === "object" &&
      !Array.isArray(record[key]) &&
      !(record[key] instanceof Date)
    ) {
      record[key] = redact(record[key]);
    }
  }
  return obj;
}

/**
 * Return a copy of headers with sensitive keys removed (for logging).
 */
export function redactHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (REDACT_KEYS.has(k.replace(/[-_]/g, "")) || k === "authorization" || k === "cookie") {
      out[key] = REDACT_PLACEHOLDER;
    } else {
      out[key] = value;
    }
  });
  return out;
}

/**
 * Redact query string: remove or mask params that look like tokens.
 */
export function redactQuery(url: string): string {
  try {
    const u = new URL(url, "http://localhost");
    u.searchParams.forEach((_, key) => {
      const k = key.toLowerCase();
      if (keyMatches(k) || k.includes("token") || k.includes("code") || k.includes("key")) {
        u.searchParams.set(key, REDACT_PLACEHOLDER);
      }
    });
    return u.pathname + u.search;
  } catch {
    return "[invalid-url]";
  }
}
