import { redact, redactHeaders, redactQuery } from "./redact";

describe("redact", () => {
  it("redacts authorization and cookie keys", () => {
    const obj = { authorization: "Bearer xyz", cookie: "session=abc", role: "admin" };
    redact(obj);
    expect(obj).toEqual({ authorization: "[REDACTED]", cookie: "[REDACTED]", role: "admin" });
  });

  it("redacts token, email, acceptUrl (case-insensitive)", () => {
    const obj = { Token: "secret", EMAIL: "u@x.com", accept_url: "https://x.com?token=1" };
    redact(obj);
    expect(obj.Token).toBe("[REDACTED]");
    expect(obj.EMAIL).toBe("[REDACTED]");
    expect(obj.accept_url).toBe("[REDACTED]");
  });

  it("redacts nested keys", () => {
    const obj = { user: { email: "a@b.com", id: "uuid-1" } };
    redact(obj);
    expect((obj as { user: { email: string; id: string } }).user.email).toBe("[REDACTED]");
    expect((obj as { user: { email: string; id: string } }).user.id).toBe("uuid-1");
  });

  it("does not mutate non-objects", () => {
    expect(redact(null)).toBe(null);
    expect(redact(undefined)).toBe(undefined);
    expect(redact("hello")).toBe("hello");
  });
});

describe("redactHeaders", () => {
  it("redacts Authorization and Cookie", () => {
    const headers = new Headers();
    headers.set("Authorization", "Bearer x");
    headers.set("Cookie", "s=1");
    headers.set("Content-Type", "application/json");
    const out = redactHeaders(headers);
    expect(out["authorization"] ?? out["Authorization"]).toBe("[REDACTED]");
    expect(out["cookie"] ?? out["Cookie"]).toBe("[REDACTED]");
    expect(out["Content-Type"] ?? out["content-type"]).toBe("application/json");
  });
});

describe("redactQuery", () => {
  it("redacts token and code params", () => {
    const url = "http://localhost/api/callback?token=abc&code=xyz&state=ok";
    const result = redactQuery(url);
    expect(result).toMatch(/REDACTED/);
    expect(result).not.toContain("abc");
    expect(result).not.toContain("xyz");
  });
});
