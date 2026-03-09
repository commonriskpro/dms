/**
 * Permissions list: query validation (limit/offset/module) and pagination + module filter.
 */
import { z } from "zod";
import * as permissionDb from "../db/permission";

const permissionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  module: z.string().optional(),
});

describe("Permissions list query schema", () => {
  it("rejects limit > 100", () => {
    expect(() =>
      permissionsQuerySchema.parse({ limit: 101, offset: 0 })
    ).toThrow();
    expect(() =>
      permissionsQuerySchema.parse({ limit: 200 })
    ).toThrow();
  });

  it("accepts limit 1..100 and offset >= 0", () => {
    expect(permissionsQuerySchema.parse({ limit: 1, offset: 0 })).toEqual({
      limit: 1,
      offset: 0,
      module: undefined,
    });
    expect(permissionsQuerySchema.parse({ limit: 100, offset: 10 })).toEqual({
      limit: 100,
      offset: 10,
      module: undefined,
    });
  });

  it("defaults limit to 100 and offset to 0", () => {
    expect(permissionsQuerySchema.parse({})).toEqual({
      limit: 100,
      offset: 0,
      module: undefined,
    });
  });

  it("coerces string params and accepts optional module", () => {
    expect(
      permissionsQuerySchema.parse({
        limit: "25",
        offset: "50",
        module: "admin",
      })
    ).toEqual({ limit: 25, offset: 50, module: "admin" });
  });
});


describe("Permissions list pagination and filter", () => {
  it("returns first page with correct size and total", async () => {
    const limit = 5;
    const offset = 0;
    const { data, total } = await permissionDb.listPermissionsPaginated(
      undefined,
      { limit, offset }
    );
    expect(data.length).toBeLessThanOrEqual(limit);
    expect(total).toBeGreaterThanOrEqual(data.length);
    if (total > limit) {
      expect(data.length).toBe(limit);
    }
  });

  it("returns second page with different rows", async () => {
    const limit = 3;
    const first = await permissionDb.listPermissionsPaginated(undefined, {
      limit,
      offset: 0,
    });
    const second = await permissionDb.listPermissionsPaginated(undefined, {
      limit,
      offset: limit,
    });
    expect(first.data.length).toBeLessThanOrEqual(limit);
    expect(second.data.length).toBeLessThanOrEqual(limit);
    if (first.data.length === limit && second.data.length > 0) {
      expect(first.data[0].id).not.toBe(second.data[0].id);
    }
  });

  it("module filter applies to both total and data", async () => {
    const { data: allData, total: allTotal } =
      await permissionDb.listPermissionsPaginated(undefined, {
        limit: 100,
        offset: 0,
      });
    const adminOnly = allData.filter((p) => p.module === "admin");
    if (adminOnly.length === 0) return; // seed may have no admin module

    const { data: filteredData, total: filteredTotal } =
      await permissionDb.listPermissionsPaginated(
        { module: "admin" },
        { limit: 100, offset: 0 }
      );
    expect(filteredTotal).toBe(adminOnly.length);
    expect(filteredData.length).toBe(filteredTotal);
    expect(filteredData.every((p) => p.module === "admin")).toBe(true);
  });
});
