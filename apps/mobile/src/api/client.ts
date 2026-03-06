import { getDealerApiUrl } from "@/lib/env";
import { getValidAccessToken } from "@/auth/auth-service";
import { getCurrentSession } from "@/auth/runtime-session";
import { parseErrorResponse, DealerApiError } from "@/api/errors";
import { getOnUnauthorized } from "@/api/on-unauthorized";
import { authDebug } from "@/lib/auth-debug";

export type RequestConfig = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
};

/** Use for multipart/form-data uploads. Do not set Content-Type; fetch sets it with boundary. */
export type FormDataRequestConfig = {
  method?: "POST" | "PUT" | "PATCH";
  body: FormData;
  headers?: Record<string, string>;
};

const DEFAULT_TIMEOUT_MS = 30_000;
let requestCounter = 0;

function normalizeUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  const p = path.replace(/^\/+/, "");
  return p ? `${base}/${p}` : base;
}

async function getAccessToken(traceId: number): Promise<{ token: string | null; source: "runtime" | "fallback" | "none" }> {
  /**
   * Use in-memory session first so the first request after login
   * has the token before any async SecureStore/refresh.
   */
  const runtime = getCurrentSession();
  if (runtime?.accessToken) {
    authDebug("api-client.token-source.runtime", { traceId, hasAccessToken: true });
    return { token: runtime.accessToken, source: "runtime" };
  }

  const fallbackToken = await getValidAccessToken();
  if (fallbackToken) {
    authDebug("api-client.token-source.fallback", { traceId, hasAccessToken: true });
    return { token: fallbackToken, source: "fallback" };
  }
  authDebug("api-client.token-source.none", { traceId, hasAccessToken: false });
  return { token: null, source: "none" };
}

function userFriendlyMessage(error: unknown, fallback: string): string {
  if (error instanceof DealerApiError) return error.message;

  if (error instanceof TypeError && error.message?.includes("fetch")) {
    return "Network error. Check your connection and try again.";
  }

  if (error instanceof Error) {
    if (/network|failed to fetch|load failed/i.test(error.message)) {
      return "Could not reach server. Check your connection.";
    }
    if (/timeout|timed out|aborted/i.test(error.message)) {
      return "Request timed out. Try again.";
    }
  }

  return fallback;
}

export async function dealerFetch<T>(
  path: string,
  config: RequestConfig = {},
  retried = false
): Promise<T> {
  const traceId = ++requestCounter;
  const baseUrl = getDealerApiUrl();
  const url = path.startsWith("http") ? path : normalizeUrl(baseUrl, path);

  const { token, source } = await getAccessToken(traceId);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...config.headers,
  };

  /**
   * Respect an explicitly passed Authorization header on retries,
   * otherwise use the resolved token.
   */
  if (!headers.Authorization && token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const hadAuthorizationHeader = Boolean(headers.Authorization);
  authDebug("api-client.request.init", {
    traceId,
    path,
    retried,
    tokenSource: source,
    hasAuthorization: hadAuthorizationHeader,
  });

  const init: RequestInit = {
    method: config.method ?? "GET",
    headers,
  };

  if (config.body != null && init.method !== "GET") {
    init.body = JSON.stringify(config.body);
  }

  let res: Response;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      res = await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  } catch (e) {
    authDebug("api-client.request.network-error", {
      traceId,
      path,
      retried,
    });
    const message = userFriendlyMessage(e, "Request failed");
    throw new DealerApiError("NETWORK", message, 0);
  }

  let body: unknown;
  const contentType = res.headers.get("content-type");

  if (contentType?.includes("application/json")) {
    try {
      body = await res.json();
    } catch {
      body = null;
    }
  } else {
    body = null;
  }

  if (res.ok) {
    authDebug("api-client.request.ok", { traceId, path, status: res.status, retried });
    return body as T;
  }

  if (res.status === 401) {
    authDebug("api-client.request.401", { traceId, path, retried });
    if (!retried) {
      /**
       * Refresh-aware fallback attempt.
       */
      const refreshedToken = await getValidAccessToken();

      if (refreshedToken) {
        authDebug("api-client.request.401.retrying", {
          traceId,
          path,
          hasRefreshedToken: true,
        });
        return dealerFetch<T>(
          path,
          {
            ...config,
            headers: {
              ...config.headers,
              Authorization: `Bearer ${refreshedToken}`,
            },
          },
          true
        );
      }
      authDebug("api-client.request.401.no-refreshed-token", { traceId, path });
    }

    const cb = getOnUnauthorized();
    if (cb && hadAuthorizationHeader) {
      authDebug("api-client.request.401.on-unauthorized-callback", {
        traceId,
        path,
      });
      cb();
    } else if (!hadAuthorizationHeader) {
      authDebug("api-client.request.401.skip-on-unauthorized-no-auth-header", {
        traceId,
        path,
      });
    }

    throw parseErrorResponse(res.status, body);
  }

  throw parseErrorResponse(res.status, body);
}

/**
 * Dealer API request with FormData body (e.g. photo upload). Does not set Content-Type so the runtime sets multipart boundary.
 */
export async function dealerFetchFormData<T>(
  path: string,
  config: FormDataRequestConfig,
  retried = false
): Promise<T> {
  const traceId = ++requestCounter;
  const baseUrl = getDealerApiUrl();
  const url = path.startsWith("http") ? path : normalizeUrl(baseUrl, path);
  const { token } = await getAccessToken(traceId);
  const headers: Record<string, string> = { ...config.headers };
  if (!headers.Authorization && token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const init: RequestInit = {
    method: config.method ?? "POST",
    headers,
    body: config.body,
  };
  let res: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    try {
      res = await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  } catch (e) {
    const message = userFriendlyMessage(e, "Upload failed");
    throw new DealerApiError("NETWORK", message, 0);
  }
  let body: unknown;
  const contentType = res.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    try {
      body = await res.json();
    } catch {
      body = null;
    }
  } else {
    body = null;
  }
  if (res.ok) return body as T;
  if (res.status === 401 && !retried) {
    const refreshedToken = await getValidAccessToken();
    if (refreshedToken) {
      return dealerFetchFormData<T>(
        path,
        { ...config, headers: { ...config.headers, Authorization: `Bearer ${refreshedToken}` } },
        true
      );
    }
  }
  throw parseErrorResponse(res.status, body);
}

/**
 * Dealer API request without Authorization. Use for public endpoints (e.g. invite resolve, invite accept signup).
 */
export async function dealerFetchPublic<T>(
  path: string,
  config: RequestConfig = {}
): Promise<T> {
  const traceId = ++requestCounter;
  const baseUrl = getDealerApiUrl();
  const url = path.startsWith("http") ? path : normalizeUrl(baseUrl, path);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...config.headers,
  };

  const init: RequestInit = {
    method: config.method ?? "GET",
    headers,
  };

  if (config.body != null && init.method !== "GET") {
    init.body = JSON.stringify(config.body);
  }

  let res: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      res = await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  } catch (e) {
    authDebug("api-client.public.request.network-error", { traceId, path });
    const message = userFriendlyMessage(e, "Request failed");
    throw new DealerApiError("NETWORK", message, 0);
  }

  let body: unknown;
  const contentType = res.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    try {
      body = await res.json();
    } catch {
      body = null;
    }
  } else {
    body = null;
  }

  if (res.ok) {
    authDebug("api-client.public.request.ok", { traceId, path, status: res.status });
    return body as T;
  }

  throw parseErrorResponse(res.status, body);
}

export { DealerApiError };