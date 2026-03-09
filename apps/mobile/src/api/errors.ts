export type ApiErrorPayload = {
  error: { code: string; message: string; details?: Record<string, unknown> };
};

export function isApiErrorBody(body: unknown): body is ApiErrorPayload {
  return (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as ApiErrorPayload).error === "object" &&
    typeof (body as ApiErrorPayload).error.code === "string" &&
    typeof (body as ApiErrorPayload).error.message === "string"
  );
}

export class DealerApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "DealerApiError";
  }
}

export function parseErrorResponse(status: number, body: unknown): DealerApiError {
  if (isApiErrorBody(body)) {
    return new DealerApiError(
      body.error.code,
      body.error.message,
      status,
      body.error.details
    );
  }
  return new DealerApiError(
    "UNKNOWN",
    status === 401 ? "Unauthorized" : status === 403 ? "Forbidden" : "Request failed",
    status
  );
}
