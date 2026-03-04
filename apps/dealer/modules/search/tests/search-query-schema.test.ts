/**
 * Unit tests: search query Zod schema — q required and min 2; limit default 20 max accepted then capped; offset min 0.
 */
import { searchQuerySchema } from "@/app/api/search/schemas";

describe("searchQuerySchema", () => {
  it("accepts valid query: q min length 2, limit default 20, offset default 0", () => {
    const result = searchQuerySchema.parse({ q: "ab" });
    expect(result.q).toBe("ab");
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(0);
  });

  it("trims q and accepts when length >= 2", () => {
    const result = searchQuerySchema.parse({ q: "  xy  " });
    expect(result.q).toBe("xy");
  });

  it("accepts limit in [1, 50] and offset >= 0", () => {
    expect(searchQuerySchema.parse({ q: "ab", limit: 1 }).limit).toBe(1);
    expect(searchQuerySchema.parse({ q: "ab", limit: 50 }).limit).toBe(50);
    expect(searchQuerySchema.parse({ q: "ab", offset: 0 }).offset).toBe(0);
    expect(searchQuerySchema.parse({ q: "ab", offset: 10 }).offset).toBe(10);
  });

  it("rejects limit > 50 (spec max)", () => {
    expect(() => searchQuerySchema.parse({ q: "ab", limit: 51 })).toThrow();
    expect(() => searchQuerySchema.parse({ q: "ab", limit: 100 })).toThrow();
  });

  it("rejects missing q", () => {
    expect(() => searchQuerySchema.parse({})).toThrow();
    expect(() => searchQuerySchema.parse({ limit: 20 })).toThrow();
  });

  it("rejects q with length < 2 after trim", () => {
    expect(() => searchQuerySchema.parse({ q: "" })).toThrow();
    expect(() => searchQuerySchema.parse({ q: "a" })).toThrow();
    expect(() => searchQuerySchema.parse({ q: "  " })).toThrow();
  });

  it("rejects limit < 1", () => {
    expect(() => searchQuerySchema.parse({ q: "ab", limit: 0 })).toThrow();
    expect(() => searchQuerySchema.parse({ q: "ab", limit: -1 })).toThrow();
  });

  it("rejects offset < 0", () => {
    expect(() => searchQuerySchema.parse({ q: "ab", offset: -1 })).toThrow();
  });
});
