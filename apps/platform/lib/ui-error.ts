"use client";

import type { ApiError } from "@/lib/api-client";

function extractRequestId(details: unknown): string | null {
  if (!details || typeof details !== "object") return null;
  const value = (details as Record<string, unknown>).requestId;
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function getPlatformUiErrorMessage(input: {
  status?: number;
  error?: ApiError | null;
  fallback: string;
}): string {
  if (input.status === 401) return "Sign in again at /platform/login.";
  if (input.status === 403) return "You don't have access for this action.";
  if (input.status === 422) return "Validation failed. Check your inputs and try again.";
  if (input.status === 502) {
    const requestId = extractRequestId(input.error?.details);
    return requestId ? `Dealer call failed. RequestId: ${requestId}` : "Dealer call failed.";
  }
  return input.error?.message || input.fallback;
}
