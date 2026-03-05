import { z } from "zod";
import { ApiError } from "@/lib/auth";
import { toErrorPayload, isApiError, errorResponse } from "./errors";

describe("API errors", () => {
  it("toErrorPayload returns 422 for ZodError", () => {
    const result = z.object({ id: z.string().uuid() }).safeParse({ id: "not-a-uuid" });
    expect(result.success).toBe(false);
    const err = (result as { success: false; error: z.ZodError }).error;
    const { status, body } = toErrorPayload(err);
    expect(status).toBe(422);
    expect(body.error?.code).toBe("VALIDATION_ERROR");
    expect(body.error?.message).toBe("Validation failed");
    expect(body.error?.details).toBeDefined();
  });

  it("isApiError identifies ApiError instances", () => {
    expect(isApiError(new ApiError("FORBIDDEN", "x"))).toBe(true);
    expect(isApiError(new Error("x"))).toBe(false);
    expect(isApiError(null)).toBe(false);
  });

  it("toErrorPayload returns correct status for ApiError codes", () => {
    expect(toErrorPayload(new ApiError("UNAUTHORIZED", "x")).status).toBe(401);
    expect(toErrorPayload(new ApiError("FORBIDDEN", "x")).status).toBe(403);
    expect(toErrorPayload(new ApiError("NOT_FOUND", "x")).status).toBe(404);
    expect(toErrorPayload(new ApiError("INVITE_NOT_FOUND", "x")).status).toBe(404);
    expect(toErrorPayload(new ApiError("VALIDATION_ERROR", "x")).status).toBe(400);
    expect(toErrorPayload(new ApiError("INVALID_VIN", "Invalid VIN")).status).toBe(400);
    expect(toErrorPayload(new ApiError("DOMAIN_ERROR", "x")).status).toBe(422);
    expect(toErrorPayload(new ApiError("CONFLICT", "x")).status).toBe(409);
    expect(toErrorPayload(new ApiError("GONE", "x")).status).toBe(410);
    expect(toErrorPayload(new ApiError("INVITE_EXPIRED", "x")).status).toBe(410);
    expect(toErrorPayload(new ApiError("INVITE_ALREADY_ACCEPTED", "x")).status).toBe(410);
    expect(toErrorPayload(new ApiError("INVITE_MEMBERSHIP_EXISTS", "x")).status).toBe(409);
    expect(toErrorPayload(new ApiError("RATE_LIMITED", "x")).status).toBe(429);
    expect(toErrorPayload(new Error("unknown")).status).toBe(500);
  });

  it("errorResponse produces standard shape", () => {
    const body = errorResponse("CODE", "message", { key: "value" });
    expect(body).toEqual({
      error: { code: "CODE", message: "message", details: { key: "value" } },
    });
  });
});
