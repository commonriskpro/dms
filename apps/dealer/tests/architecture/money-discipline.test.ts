/** @jest-environment node */
/**
 * Money / numeric discipline: API uses string cents; no raw BigInt in JSON; no float for money.
 * High-signal checks on known serializer and route patterns.
 */
import { readFile } from "./helpers";

describe("money discipline", () => {
  it("deals serialize module uses string cents for money fields (no raw BigInt in response)", () => {
    try {
      const content = readFile("app/api/deals/serialize.ts");
      expect(content).toMatch(/\.toString\(\)|String\(.*[Cc]ents/);
      expect(content).not.toMatch(/return\s*\{[^}]*[a-zA-Z]+[Cc]ents\s*:[^}]*\bBigInt\b/);
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return;
      throw e;
    }
  });

  it("lib/money exports formatCents and parseDollarsToCents", () => {
    const content = readFile("lib/money.ts");
    expect(content).toContain("formatCents");
    expect(content).toContain("parseDollarsToCents");
  });

  it("known serializer files do not use number/float for money in API output", () => {
    const serializerPaths = [
      "modules/websites-public/serialize.ts",
      "app/api/deals/serialize.ts",
      "modules/lender-integration/serialize.ts",
    ];
    for (const rel of serializerPaths) {
      try {
        const content = readFile(rel);
        const badPattern = /(salePriceCents|allowanceCents|payoffCents|amountCents)\s*:\s*[^s].*number|:\s*parseFloat|:\s*Number\(/;
        expect(content).not.toMatch(badPattern);
      } catch (e: unknown) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw e;
      }
    }
  });
});
