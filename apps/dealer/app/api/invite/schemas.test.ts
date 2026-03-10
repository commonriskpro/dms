import {
  acceptInviteBodySchema,
  acceptInviteSignupBodySchema,
  resolveInviteQuerySchema,
} from "./schemas";

describe("Invite flow schemas", () => {
  describe("resolveInviteQuerySchema", () => {
    it("accepts a valid token", () => {
      expect(resolveInviteQuerySchema.parse({ token: "abc123" })).toEqual({ token: "abc123" });
    });

    it("rejects missing token", () => {
      expect(() => resolveInviteQuerySchema.parse({})).toThrow();
    });
  });

  describe("acceptInviteBodySchema", () => {
    it("accepts valid token", () => {
      expect(acceptInviteBodySchema.parse({ token: "abc123" })).toEqual({ token: "abc123" });
    });

    it("rejects empty token", () => {
      expect(() => acceptInviteBodySchema.parse({ token: "" })).toThrow();
    });
  });

  describe("acceptInviteSignupBodySchema", () => {
    it("accepts signup payload", () => {
      expect(
        acceptInviteSignupBodySchema.parse({
          token: "abc123",
          email: "u@example.com",
          password: "StrongPassword123!",
          confirmPassword: "StrongPassword123!",
          fullName: "User Example",
        })
      ).toEqual({
        token: "abc123",
        email: "u@example.com",
        password: "StrongPassword123!",
        confirmPassword: "StrongPassword123!",
        fullName: "User Example",
      });
    });

    it("rejects invalid email", () => {
      expect(() =>
        acceptInviteSignupBodySchema.parse({
          token: "abc123",
          email: "not-email",
          password: "StrongPassword123!",
        })
      ).toThrow();
    });

    it("rejects missing token", () => {
      expect(() =>
        acceptInviteSignupBodySchema.parse({
          email: "u@example.com",
          password: "StrongPassword123!",
        })
      ).toThrow();
    });
  });
});
