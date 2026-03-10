import type { NextRequest } from "next/server";

export type RequestCache = Map<string, unknown>;

const requestCacheStore = new WeakMap<NextRequest, RequestCache>();

export function getRequestCache(request?: NextRequest): RequestCache | undefined {
  if (!request) return undefined;
  let cache = requestCacheStore.get(request);
  if (!cache) {
    cache = new Map<string, unknown>();
    requestCacheStore.set(request, cache);
  }
  return cache;
}

export async function getOrSetRequestCacheValue<T>(
  cache: RequestCache | undefined,
  key: string,
  loader: () => Promise<T>
): Promise<T> {
  if (!cache) return loader();

  if (cache.has(key)) {
    const existing = cache.get(key) as Promise<T> | T;
    return await existing;
  }

  const pending = loader()
    .then((value) => {
      cache.set(key, value);
      return value;
    })
    .catch((error) => {
      cache.delete(key);
      throw error;
    });

  cache.set(key, pending);
  return pending;
}
