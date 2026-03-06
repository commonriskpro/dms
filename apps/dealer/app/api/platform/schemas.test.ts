import {
  listDealershipsQuerySchema,
  createDealershipBodySchema,
  patchDealershipBodySchema,
  listMembersQuerySchema,
  addMemberBodySchema,
  patchMembershipBodySchema,
  impersonateBodySchema,
  createInviteBodySchema,
  acceptInviteBodySchema,
  approvePendingBodySchema,
} from "./schemas";

describe("Platform API schemas", () => {
  describe("listDealershipsQuerySchema", () => {
    it("defaults limit 20 and offset 0", () => {
      expect(listDealershipsQuerySchema.parse({})).toEqual({ limit: 20, offset: 0 });
    });
    it("accepts limit, offset, search", () => {
      expect(
        listDealershipsQuerySchema.parse({
          limit: "10",
          offset: "5",
          search: "acme",
        })
      ).toEqual({ limit: 10, offset: 5, search: "acme" });
    });
    it("rejects limit > 100", () => {
      expect(() => listDealershipsQuerySchema.parse({ limit: 101 })).toThrow();
    });
  });

  describe("createDealershipBodySchema", () => {
    it("accepts name only", () => {
      expect(createDealershipBodySchema.parse({ name: "Acme" })).toEqual({
        name: "Acme",
        createDefaultLocation: true,
      });
    });
    it("accepts name, slug, createDefaultLocation", () => {
      expect(
        createDealershipBodySchema.parse({
          name: "Acme",
          slug: "acme",
          createDefaultLocation: false,
        })
      ).toEqual({ name: "Acme", slug: "acme", createDefaultLocation: false });
    });
    it("rejects empty name", () => {
      expect(() => createDealershipBodySchema.parse({ name: "" })).toThrow();
    });
  });

  describe("patchDealershipBodySchema", () => {
    it("accepts optional name, slug, isActive", () => {
      expect(
        patchDealershipBodySchema.parse({ name: "New Name", isActive: false })
      ).toEqual({ name: "New Name", isActive: false });
    });
    it("accepts empty object", () => {
      expect(patchDealershipBodySchema.parse({})).toEqual({});
    });
  });

  describe("listMembersQuerySchema", () => {
    it("defaults limit 20 and offset 0", () => {
      expect(listMembersQuerySchema.parse({})).toEqual({ limit: 20, offset: 0 });
    });
  });

  describe("addMemberBodySchema", () => {
    it("accepts valid email and roleId uuid", () => {
      const roleId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
      expect(
        addMemberBodySchema.parse({ email: "u@example.com", roleId })
      ).toEqual({ email: "u@example.com", roleId });
    });
    it("rejects invalid email", () => {
      expect(() =>
        addMemberBodySchema.parse({ email: "not-email", roleId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" })
      ).toThrow();
    });
    it("rejects invalid uuid for roleId", () => {
      expect(() =>
        addMemberBodySchema.parse({ email: "u@example.com", roleId: "not-uuid" })
      ).toThrow();
    });
  });

  describe("patchMembershipBodySchema", () => {
    it("accepts optional roleId and disabled", () => {
      const roleId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
      expect(
        patchMembershipBodySchema.parse({ roleId, disabled: true })
      ).toEqual({ roleId, disabled: true });
    });
  });

  describe("impersonateBodySchema", () => {
    it("accepts valid dealershipId uuid", () => {
      const dealershipId = "b2000000-0000-0000-0000-000000000002";
      expect(impersonateBodySchema.parse({ dealershipId })).toEqual({ dealershipId });
    });
    it("rejects invalid uuid", () => {
      expect(() => impersonateBodySchema.parse({ dealershipId: "x" })).toThrow();
    });
  });

  describe("createInviteBodySchema", () => {
    const validRoleId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    it("accepts valid email and roleId", () => {
      expect(
        createInviteBodySchema.parse({ email: "u@example.com", roleId: validRoleId })
      ).toEqual({ email: "u@example.com", roleId: validRoleId });
    });
    it("rejects invalid email", () => {
      expect(() =>
        createInviteBodySchema.parse({ email: "not-an-email", roleId: validRoleId })
      ).toThrow();
    });
    it("rejects missing roleId", () => {
      expect(() =>
        createInviteBodySchema.parse({ email: "u@example.com" })
      ).toThrow();
    });
    it("rejects invalid roleId (not uuid)", () => {
      expect(() =>
        createInviteBodySchema.parse({ email: "u@example.com", roleId: "not-uuid" })
      ).toThrow();
    });
  });

  describe("acceptInviteBodySchema", () => {
    it("accepts valid token", () => {
      expect(acceptInviteBodySchema.parse({ token: "abc123" })).toEqual({ token: "abc123" });
    });
    it("rejects missing token", () => {
      expect(() => acceptInviteBodySchema.parse({})).toThrow();
    });
    it("rejects empty token", () => {
      expect(() => acceptInviteBodySchema.parse({ token: "" })).toThrow();
    });
  });

  describe("approvePendingBodySchema", () => {
    const validDealershipId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    const validRoleId = "b2c3d4e5-f6a7-8901-bcde-f12345678901";
    it("accepts valid dealershipId and roleId", () => {
      expect(
        approvePendingBodySchema.parse({ dealershipId: validDealershipId, roleId: validRoleId })
      ).toEqual({ dealershipId: validDealershipId, roleId: validRoleId });
    });
    it("rejects missing dealershipId", () => {
      expect(() =>
        approvePendingBodySchema.parse({ roleId: validRoleId })
      ).toThrow();
    });
    it("rejects missing roleId", () => {
      expect(() =>
        approvePendingBodySchema.parse({ dealershipId: validDealershipId })
      ).toThrow();
    });
    it("rejects invalid dealershipId (not uuid)", () => {
      expect(() =>
        approvePendingBodySchema.parse({ dealershipId: "x", roleId: validRoleId })
      ).toThrow();
    });
    it("rejects invalid roleId (not uuid)", () => {
      expect(() =>
        approvePendingBodySchema.parse({ dealershipId: validDealershipId, roleId: "y" })
      ).toThrow();
    });
  });
});
