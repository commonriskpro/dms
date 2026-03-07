/**
 * Field encryption: maskSsn; encrypt/decrypt roundtrip when key is set.
 * SSN/encryption must never leak in logs or API.
 */
import { maskSsn, encryptField, decryptField } from "./field-encryption";

describe("field-encryption", () => {
  describe("maskSsn", () => {
    it("masks to ***-**-XXXX for 9 digits", () => {
      expect(maskSsn("123456789")).toBe("***-**-6789");
    });

    it("returns ***-**-**** when fewer than 4 digits", () => {
      expect(maskSsn("12")).toBe("***-**-****");
    });

    it("returns empty string for null/undefined", () => {
      expect(maskSsn(null)).toBe("");
      expect(maskSsn(undefined)).toBe("");
    });

    it("strips non-digits and masks last 4", () => {
      expect(maskSsn("123-45-6789")).toBe("***-**-6789");
    });
  });

  describe("encryptField / decryptField", () => {
    const orig = process.env.SSN_ENCRYPTION_KEY;
    const fallback = process.env.FIELD_ENCRYPTION_KEY;

    afterEach(() => {
      if (orig !== undefined) process.env.SSN_ENCRYPTION_KEY = orig;
      else delete process.env.SSN_ENCRYPTION_KEY;
      if (fallback !== undefined) process.env.FIELD_ENCRYPTION_KEY = fallback;
      else delete process.env.FIELD_ENCRYPTION_KEY;
    });

    it("decryptField(encryptField(plain)) returns plain when key is set", () => {
      process.env.SSN_ENCRYPTION_KEY = "a-long-secret-key-at-least-16-chars";
      delete process.env.FIELD_ENCRYPTION_KEY;
      const plain = "123456789";
      const cipher = encryptField(plain);
      expect(cipher).not.toBe(plain);
      expect(decryptField(cipher)).toBe(plain);
    });

    it("decryptField returns null for invalid/tampered cipher", () => {
      process.env.SSN_ENCRYPTION_KEY = "a-long-secret-key-at-least-16-chars";
      expect(decryptField("not-valid-base64")).toBeNull();
      expect(decryptField("")).toBeNull();
    });
  });
});
