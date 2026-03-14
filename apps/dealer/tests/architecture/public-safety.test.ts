/** @jest-environment node */
/**
 * Public safety: public serializers must not leak internal fields.
 * - Public vehicle serializer must not expose purchasePriceCents, dealershipId in returned object.
 * - Public responses must use string for price (no raw BigInt in JSON).
 */
import { readFile } from "./helpers";

const PUBLIC_SERIALIZE_REL = "modules/websites-public/serialize.ts";

describe("public safety / serialization", () => {
  it("public vehicle serializer does not expose purchasePriceCents or dealershipId in return object", () => {
    const content = readFile(PUBLIC_SERIALIZE_REL);
    expect(content).toContain("salePriceCents");
    expect(content).not.toMatch(/^\s*purchasePriceCents\s*:/m);
    expect(content).not.toMatch(/^\s*dealershipId\s*:/m);
  });

  it("public vehicle serializer uses string for price (no raw BigInt in JSON)", () => {
    const content = readFile(PUBLIC_SERIALIZE_REL);
    expect(content).toMatch(/price:.*\.toString\(\)|salePriceCents\.toString\(\)/);
  });
});
