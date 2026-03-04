import { ApiError } from "@/lib/auth";

export type ErrorPayload = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

export function errorResponse(code: string, message: string, details?: Record<string, unknown>): ErrorPayload {
  return { error: { code, message, ...(details && { details }) } };
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

export function toErrorPayload(e: unknown): { status: number; body: ErrorPayload } {
  if (isApiError(e)) {
    const status =
      e.code === "UNAUTHORIZED"
        ? 401
        : e.code === "FORBIDDEN" ||
            e.code === "INVITE_EMAIL_MISMATCH" ||
            e.code === "TENANT_SUSPENDED" ||
            e.code === "TENANT_CLOSED"
          ? 403
          : e.code === "NOT_FOUND" || e.code === "INVITE_NOT_FOUND"
            ? 404
            : e.code === "VALIDATION_ERROR"
              ? 400
              : e.code === "DOMAIN_ERROR"
                ? 422
                : e.code === "CONFLICT" ||
                    e.code === "EMAIL_ALREADY_REGISTERED" ||
                    e.code === "INVITE_MEMBERSHIP_EXISTS"
                  ? 409
                  : e.code === "GONE" ||
                      e.code === "INVITE_EXPIRED" ||
                      e.code === "INVITE_ALREADY_ACCEPTED"
                    ? 410
                    : e.code === "RATE_LIMITED"
                      ? 429
                      : 500;
    return { status, body: errorResponse(e.code, e.message, e.details) };
  }
  return { status: 500, body: errorResponse("INTERNAL", "An unexpected error occurred") };
}
