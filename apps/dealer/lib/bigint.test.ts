import { toBigIntOrNull, toBigIntOrUndefined } from "./bigint";

describe("toBigIntOrUndefined", () => {
  it("returns undefined for nullish", () => {
    expect(toBigIntOrUndefined(undefined)).toBeUndefined();
    expect(toBigIntOrUndefined(null)).toBeUndefined();
  });

  it("converts string/number/bigint values", () => {
    expect(toBigIntOrUndefined("123")).toBe(123n);
    expect(toBigIntOrUndefined(456)).toBe(456n);
    expect(toBigIntOrUndefined(789n)).toBe(789n);
  });
});

describe("toBigIntOrNull", () => {
  it("returns null for nullish", () => {
    expect(toBigIntOrNull(undefined)).toBeNull();
    expect(toBigIntOrNull(null)).toBeNull();
  });

  it("converts string/number/bigint values", () => {
    expect(toBigIntOrNull("123")).toBe(123n);
    expect(toBigIntOrNull(456)).toBe(456n);
    expect(toBigIntOrNull(789n)).toBe(789n);
  });
});
