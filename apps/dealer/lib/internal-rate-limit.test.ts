import { isInternalRateLimitDisabled } from "./internal-rate-limit";

describe("internal-rate-limit production guard", () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origDisable = process.env.DISABLE_INTERNAL_RATE_LIMIT;

  afterEach(() => {
    process.env.NODE_ENV = origNodeEnv;
    process.env.DISABLE_INTERNAL_RATE_LIMIT = origDisable;
    jest.restoreAllMocks();
  });

  it("in production, rate limit is never disabled even when DISABLE_INTERNAL_RATE_LIMIT is set", () => {
    process.env.NODE_ENV = "production";
    process.env.DISABLE_INTERNAL_RATE_LIMIT = "true";
    expect(isInternalRateLimitDisabled()).toBe(false);
  });

  it("in production, rate limit is not disabled when DISABLE_INTERNAL_RATE_LIMIT is unset", () => {
    process.env.NODE_ENV = "production";
    delete process.env.DISABLE_INTERNAL_RATE_LIMIT;
    expect(isInternalRateLimitDisabled()).toBe(false);
  });

  it("in test env, rate limit is disabled", () => {
    process.env.NODE_ENV = "test";
    expect(isInternalRateLimitDisabled()).toBe(true);
  });

  it("in development with DISABLE_INTERNAL_RATE_LIMIT=true, rate limit is disabled", () => {
    process.env.NODE_ENV = "development";
    process.env.DISABLE_INTERNAL_RATE_LIMIT = "true";
    expect(isInternalRateLimitDisabled()).toBe(true);
  });
});
