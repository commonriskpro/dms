import { validatePasswordPolicy } from "./password-policy";

describe("validatePasswordPolicy", () => {
  it("returns valid for 12+ chars with 3 categories (upper, lower, digit)", () => {
    expect(validatePasswordPolicy("SecurePass123")).toEqual({ valid: true });
  });

  it("returns valid for 12+ chars with 4 categories", () => {
    expect(validatePasswordPolicy("SecurePass1!")).toEqual({ valid: true });
  });

  it("returns invalid when too short", () => {
    const r = validatePasswordPolicy("Short1!");
    expect(r.valid).toBe(false);
    expect(r.message).toContain("12");
  });

  it("returns invalid when only 2 categories", () => {
    const r = validatePasswordPolicy("securepassword");
    expect(r.valid).toBe(false);
    expect(r.message).toContain("3");
  });

  it("returns invalid when only digits and symbols", () => {
    const r = validatePasswordPolicy("123456789012!@#");
    expect(r.valid).toBe(false);
  });
});
