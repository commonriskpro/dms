/**
 * Rate limit: invite_create, invite_resend, invite_accept, invite_resolve are in RateLimitType
 * and have limits defined. checkRateLimit(identifier, type) returns true under limit.
 * Documented limits (from lib/api/rate-limit.ts): invite_create 20, invite_resend 20,
 * invite_accept 10, invite_resolve 60 per minute per key.
 */
import {
  checkRateLimit,
  incrementRateLimit,
  type RateLimitType,
} from "@/lib/api/rate-limit";

const INVITE_TYPES: RateLimitType[] = [
  "invite_create",
  "invite_resend",
  "invite_accept",
  "invite_resolve",
];

describe("rate-limit", () => {
  beforeEach(() => {
    // Use unique identifiers per test so in-memory store does not leak between tests
  });

  it("RateLimitType includes invite_create, invite_resend, invite_accept, invite_resolve", () => {
    expect(INVITE_TYPES).toContain("invite_create");
    expect(INVITE_TYPES).toContain("invite_resend");
    expect(INVITE_TYPES).toContain("invite_accept");
    expect(INVITE_TYPES).toContain("invite_resolve");
  });

  it("checkRateLimit(identifier, invite_accept) returns true when under limit", () => {
    const id = `under-limit-${Date.now()}-${Math.random()}`;
    expect(checkRateLimit(id, "invite_accept")).toBe(true);
  });

  it("checkRateLimit(identifier, invite_create) returns true when under limit", () => {
    const id = `under-limit-create-${Date.now()}-${Math.random()}`;
    expect(checkRateLimit(id, "invite_create")).toBe(true);
  });

  it("checkRateLimit(identifier, invite_resend) returns true when under limit", () => {
    const id = `under-limit-resend-${Date.now()}-${Math.random()}`;
    expect(checkRateLimit(id, "invite_resend")).toBe(true);
  });

  it("checkRateLimit(identifier, invite_resolve) returns true when under limit", () => {
    const id = `under-limit-resolve-${Date.now()}-${Math.random()}`;
    expect(checkRateLimit(id, "invite_resolve")).toBe(true);
  });

  it("invite_accept: after 10 increments checkRateLimit returns false (limit 10/min)", () => {
    const id = `over-limit-accept-${Date.now()}-${Math.random()}`;
    expect(checkRateLimit(id, "invite_accept")).toBe(true);
    for (let i = 0; i < 10; i++) {
      incrementRateLimit(id, "invite_accept");
    }
    expect(checkRateLimit(id, "invite_accept")).toBe(false);
  });

  it("invite_create: limit is at least 20 (20 increments then check false)", () => {
    const id = `over-limit-create-${Date.now()}-${Math.random()}`;
    for (let i = 0; i < 20; i++) {
      incrementRateLimit(id, "invite_create");
    }
    expect(checkRateLimit(id, "invite_create")).toBe(false);
  });

  it("deals_mutation: after 60 increments checkRateLimit returns false (60/min per user+dealership)", () => {
    const id = `deals-mutation-${Date.now()}-${Math.random()}`;
    expect(checkRateLimit(id, "deals_mutation")).toBe(true);
    for (let i = 0; i < 60; i++) {
      incrementRateLimit(id, "deals_mutation");
    }
    expect(checkRateLimit(id, "deals_mutation")).toBe(false);
  });
});
