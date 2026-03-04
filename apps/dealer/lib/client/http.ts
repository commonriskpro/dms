export type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

export class HttpError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiFetch<T>(
  input: string,
  init?: RequestInit & { expectNoContent?: boolean }
): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });

  if (init?.expectNoContent && response.status === 204) {
    return undefined as T;
  }

  const isJson = (response.headers.get("content-type") || "").includes("application/json");
  const payload = isJson ? ((await response.json()) as unknown) : null;

  if (!response.ok) {
    const apiPayload = payload as ApiErrorPayload | null;
    const code = apiPayload?.error?.code;
    const message =
      apiPayload?.error?.message ||
      `${response.status} ${response.statusText}`.trim() ||
      "Request failed";

    if (response.status === 403 && code === "TENANT_CLOSED") {
      if (typeof window !== "undefined") window.location.assign("/closed");
      throw new HttpError(response.status, message, code, apiPayload?.error?.details);
    }
    if (response.status === 403 && code === "TENANT_SUSPENDED") {
      const { notifySuspendedOnce } = await import("./lifecycle-errors");
      notifySuspendedOnce();
      throw new HttpError(response.status, message, code, apiPayload?.error?.details);
    }

    throw new HttpError(response.status, message, code, apiPayload?.error?.details);
  }

  return payload as T;
}

/** Parse API error for display in toasts; uses error.message from API when available. */
export function getApiErrorMessage(e: unknown): string {
  if (e instanceof HttpError) return e.message;
  if (e instanceof Error) return e.message;
  return "Request failed";
}
