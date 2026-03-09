type DebugMeta = Record<string, unknown> | undefined;

function isDebugEnabled(): boolean {
  if (!__DEV__) return false;
  const debugAuth = process.env.DEBUG_AUTH;
  const debugAuthPublic = process.env.EXPO_PUBLIC_DEBUG_AUTH;
  return debugAuth === "1" || debugAuthPublic === "1";
}

function safeMeta(meta?: DebugMeta): DebugMeta {
  if (!meta) return undefined;
  const clone: Record<string, unknown> = { ...meta };
  if ("token" in clone) clone.token = "[REDACTED]";
  if ("accessToken" in clone) clone.accessToken = "[REDACTED]";
  if ("refreshToken" in clone) clone.refreshToken = "[REDACTED]";
  if ("authorization" in clone) clone.authorization = "[REDACTED]";
  if ("Authorization" in clone) clone.Authorization = "[REDACTED]";
  return clone;
}

export function authDebug(event: string, meta?: DebugMeta): void {
  if (!isDebugEnabled()) return;
  const now = new Date().toISOString();
  if (meta) {
    console.log(`[AUTH_DEBUG ${now}] ${event}`, safeMeta(meta));
    return;
  }
  console.log(`[AUTH_DEBUG ${now}] ${event}`);
}

