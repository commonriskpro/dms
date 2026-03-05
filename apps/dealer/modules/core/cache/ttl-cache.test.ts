/**
 * TTL cache: get/set, expiry, clear, max entries eviction.
 */
import { createTtlCache } from "./ttl-cache";

describe("TTL cache", () => {
  it("returns undefined for missing key", () => {
    const cache = createTtlCache<number>({ ttlMs: 1000 });
    expect(cache.get("x")).toBeUndefined();
  });

  it("returns cached value for same key", () => {
    const cache = createTtlCache<number>({ ttlMs: 10000 });
    cache.set("k", 42);
    expect(cache.get("k")).toBe(42);
  });

  it("overwrites existing key", () => {
    const cache = createTtlCache<number>({ ttlMs: 10000 });
    cache.set("k", 1);
    cache.set("k", 2);
    expect(cache.get("k")).toBe(2);
  });

  it("clear removes all entries", () => {
    const cache = createTtlCache<number>({ ttlMs: 10000 });
    cache.set("a", 1);
    cache.set("b", 2);
    cache.clear();
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBeUndefined();
  });

  it("delete removes one entry", () => {
    const cache = createTtlCache<number>({ ttlMs: 10000 });
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.delete("a")).toBe(true);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe(2);
    expect(cache.delete("a")).toBe(false);
  });
});
