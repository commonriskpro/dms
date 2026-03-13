import { AsyncLocalStorage } from "node:async_hooks";
import { getOrCreateRequestId } from "@/lib/request-id";

export type RequestContextValue = {
  requestId?: string | null;
  route?: string | null;
  method?: string | null;
  dealershipId?: string | null;
  queryLabel?: string | null;
};

const requestContextStorage = new AsyncLocalStorage<RequestContextValue>();

export function runWithRequestContext<T>(
  value: RequestContextValue,
  fn: () => T
): T {
  return requestContextStorage.run({ ...value }, fn);
}

export function getRequestContext(): RequestContextValue | undefined {
  return requestContextStorage.getStore();
}

export function setRequestContext(value: Partial<RequestContextValue>): void {
  const current = requestContextStorage.getStore();
  if (current) {
    Object.assign(current, value);
    return;
  }
  requestContextStorage.enterWith({ ...value });
}

export function ensureRequestContextForRequest(
  request: Pick<Request, "headers" | "method" | "url"> & {
    nextUrl?: { pathname?: string | null } | null;
  }
): RequestContextValue {
  const current = requestContextStorage.getStore();
  if (current) return current;
  const requestId = getOrCreateRequestId(request.headers.get("x-request-id"));
  const route = request.nextUrl?.pathname ?? request.url ?? null;
  const method = request.method ?? null;
  const nextValue: RequestContextValue = { requestId, route, method };
  requestContextStorage.enterWith(nextValue);
  return nextValue;
}

export function labelQueryFamily(queryLabel: string): void {
  setRequestContext({ queryLabel });
}
