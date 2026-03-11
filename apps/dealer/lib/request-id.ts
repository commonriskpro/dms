/**
 * RequestId: get from header or generate. Use for correlation in logs and Sentry.
 */

const REQUEST_ID_HEADER = "x-request-id";

export function getOrCreateRequestId(headerValue: string | null): string {
  const trimmed = headerValue?.trim();
  if (trimmed && /^[a-zA-Z0-9_-]+$/.test(trimmed) && trimmed.length <= 128) return trimmed;
  return crypto.randomUUID();
}

export function addRequestIdToResponse(response: Response, requestId: string): Response {
  const next = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(response.headers),
  });
  next.headers.set(REQUEST_ID_HEADER, requestId);
  return next;
}
