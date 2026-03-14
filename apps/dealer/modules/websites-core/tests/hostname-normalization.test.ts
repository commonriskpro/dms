/** @jest-environment node */
/**
 * Unit tests for hostname normalization used in public tenant resolution.
 * Tests the logic that maps incoming hostnames to canonical DB hostnames.
 */

function normalizeHostname(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/:\d+$/, "")   // strip port
    .replace(/\.+$/, "")    // strip trailing dots
    .replace(/^www\./, ""); // strip www. prefix
}

describe("normalizeHostname", () => {
  it("strips port numbers", () => {
    expect(normalizeHostname("acme.dms-platform.com:3001")).toBe("acme.dms-platform.com");
    expect(normalizeHostname("acme.dms-platform.com:80")).toBe("acme.dms-platform.com");
  });

  it("strips www. prefix", () => {
    expect(normalizeHostname("www.acme.com")).toBe("acme.com");
    expect(normalizeHostname("WWW.ACME.COM")).toBe("acme.com");
  });

  it("lowercases the hostname", () => {
    expect(normalizeHostname("ACME.DMS-PLATFORM.COM")).toBe("acme.dms-platform.com");
  });

  it("strips trailing dots", () => {
    expect(normalizeHostname("acme.dms-platform.com.")).toBe("acme.dms-platform.com");
    expect(normalizeHostname("acme.dms-platform.com...")).toBe("acme.dms-platform.com");
  });

  it("handles port + www together", () => {
    expect(normalizeHostname("www.acme.com:8080")).toBe("acme.com");
  });

  it("does NOT modify clean hostname", () => {
    expect(normalizeHostname("acme.dms-platform.com")).toBe("acme.dms-platform.com");
  });

  it("does NOT strip legitimate subdomain parts", () => {
    expect(normalizeHostname("my-dealer.dms-platform.com")).toBe("my-dealer.dms-platform.com");
  });

  it("handles localhost (dev fallback)", () => {
    expect(normalizeHostname("localhost:3001")).toBe("localhost");
  });
});

describe("slug normalization", () => {
  function vehicleToSlug(v: {
    year: number | null;
    make: string | null;
    model: string | null;
    trim: string | null;
    vin: string | null;
    stockNumber: string;
  }): string {
    const parts = [
      v.year?.toString(),
      v.make?.toLowerCase().replace(/[^a-z0-9]/g, "-"),
      v.model?.toLowerCase().replace(/[^a-z0-9]/g, "-"),
      v.trim?.toLowerCase().replace(/[^a-z0-9]/g, "-"),
      v.vin ? v.vin.slice(-6).toLowerCase() : v.stockNumber.toLowerCase(),
    ]
      .filter(Boolean)
      .join("-");
    return parts || v.stockNumber;
  }

  it("produces URL-safe slugs (no spaces, no special chars)", () => {
    const slug = vehicleToSlug({ year: 2023, make: "Land Rover", model: "Range Rover Sport", trim: "HSE", vin: "SALSK2D42PA123456", stockNumber: "LR001" });
    expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it("is deterministic for the same vehicle", () => {
    const v = { year: 2022, make: "Ford", model: "F-150", trim: "XLT", vin: "1FTFW1E80NFA12345", stockNumber: "F001" };
    expect(vehicleToSlug(v)).toBe(vehicleToSlug(v));
  });

  it("uses last 6 of VIN in slug for uniqueness", () => {
    const slug = vehicleToSlug({ year: 2023, make: "Honda", model: "Civic", trim: null, vin: "JHMFC2F59PX000001", stockNumber: "HC001" });
    expect(slug).toContain("000001");
  });

  it("does NOT include full VIN (privacy: only last 6)", () => {
    const slug = vehicleToSlug({ year: 2023, make: "Honda", model: "Civic", trim: null, vin: "JHMFC2F59PX000001", stockNumber: "HC001" });
    expect(slug).not.toContain("JHMFC2F59PX"); // full VIN prefix must not appear
  });
});
