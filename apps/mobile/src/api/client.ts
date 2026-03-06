import { getDealerApiUrl } from "@/lib/env";
import { getValidAccessToken } from "@/auth/auth-service";
import { parseErrorResponse, DealerApiError } from "@/api/errors";
import { getOnUnauthorized } from "@/api/on-unauthorized";

export type RequestConfig = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
};

const DEFAULT_TIMEOUT_MS = 30_000;

function normalizeUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  const p = path.replace(/^\/+/, "");
  return p ? `${base}/${p}` : base;
}

async function getAccessToken(): Promise<string | null> {
  return getValidAccessToken();
}

function userFriendlyMessage(error: unknown, fallback: string): string {
  if (error instanceof DealerApiError) return error.message;
  if (error instanceof TypeError && error.message?.includes("fetch")) {
    return "Network error. Check your connection and try again.";
  }
  if (error instanceof Error) {
    if (/network|failed to fetch|load failed/i.test(error.message)) return "Could not reach server. Check your connection.";
    if (/timeout|timed out/i.test(error.message)) return "Request timed out. Try again.";
  }
  return fallback;
}

export async function dealerFetch<T>(
  path: string,
  config: RequestConfig = {},
  retried = false
): Promise<T> {
  const baseUrl = getDealerApiUrl();
  const url = path.startsWith("http") ? path : normalizeUrl(baseUrl, path);

  const token = await getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...config.headers,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const init: RequestInit = {
    method: config.method ?? "GET",
    headers,
  };
  if (config.body != null && config.method !== "GET") {
    init.body = JSON.stringify(config.body);
  }

  let res: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    res = await fetch(url, { ...init, signal: controller.signal });
    clearTimeout(timeout);
  } catch (e) {
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
    return body as T;
  }

  if (res.status === 401) {
    if (!retried) {
      const newToken = await getValidAccessToken();
      if (newToken) {
        return dealerFetch<T>(
          path,
          { ...config, headers: { ...config.headers, Authorization: `Bearer ${newToken}` } },
          true
        );
      }
    }
    const cb = getOnUnauthorized();
    if (cb) cb();
    throw parseErrorResponse(res.status, body);
  }

  throw parseErrorResponse(res.status, body);
}

export { DealerApiError };
