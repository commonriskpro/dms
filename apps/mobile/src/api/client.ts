import { getDealerApiUrl } from "@/lib/env";
import { getValidAccessToken } from "@/auth/auth-service";
import { parseErrorResponse, DealerApiError } from "@/api/errors";

export type RequestConfig = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
};

async function getAccessToken(): Promise<string | null> {
  return getValidAccessToken();
}

export async function dealerFetch<T>(
  path: string,
  config: RequestConfig = {},
  retried = false
): Promise<T> {
  const baseUrl = getDealerApiUrl().replace(/\/$/, "");
  const url = path.startsWith("http") ? path : `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
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

  const res = await fetch(url, init);
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

  if (res.status === 401 && !retried) {
    const { getValidAccessToken } = await import("@/auth/auth-service");
    const newToken = await getValidAccessToken();
    if (newToken) {
      return dealerFetch<T>(path, { ...config, headers: { ...config.headers, Authorization: `Bearer ${newToken}` } }, true);
    }
  }

  throw parseErrorResponse(res.status, body);
}

export { DealerApiError };
