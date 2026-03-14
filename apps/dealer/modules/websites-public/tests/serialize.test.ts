/** @jest-environment node */
/**
 * Unit tests for public-safe serializers.
 * Verifies: field allowlist, no internal-only data exposed, slug generation, price visibility.
 */

import { vehicleToSlug, serializePublicVehicleSummary, serializePublicVehicleDetail } from "../serialize";

const BASE_VEHICLE = {
  id: "v-secret-uuid",
  dealershipId: "d-secret-dealership-uuid",
  stockNumber: "STK001",
  vin: "1HGCM82633A123456",
  year: 2023,
  make: "Honda",
  model: "Accord",
  trim: "Sport",
  color: "Silver",
  mileage: 15000,
  salePriceCents: BigInt(2999900),
  purchasePriceCents: BigInt(2000000), // internal — must not be exposed
  status: "AVAILABLE" as const,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  deletedAt: null,
  deletedBy: null,
  vehiclePhotos: [],
} as unknown as Parameters<typeof serializePublicVehicleSummary>[0]["vehicle"] & Record<string, unknown>;

const BASE_SETTINGS = {
  id: "ws-secret-uuid",
  vehicleId: "v-secret-uuid",
  dealershipId: "d-secret-dealership-uuid",
  isPublished: true,
  isFeatured: false,
  hidePrice: false,
  customHeadline: null,
  customDescription: null,
  sortPriority: 0,
  primaryPhotoOverrideId: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

const vehicleWithSettings = {
  ...BASE_VEHICLE,
  websiteSettings: BASE_SETTINGS,
  vehiclePhotos: [],
} as Parameters<typeof serializePublicVehicleSummary>[0];

describe("vehicleToSlug", () => {
  it("generates slug from year+make+model+trim+vin-last-6", () => {
    const slug = vehicleToSlug({ year: 2023, make: "Honda", model: "Accord", trim: "Sport", vin: "1HGCM82633A123456", stockNumber: "STK001" });
    expect(slug).toBe("2023-honda-accord-sport-123456");
  });

  it("falls back to lowercased stockNumber when all other fields are null", () => {
    const slug = vehicleToSlug({ year: null, make: null, model: null, trim: null, vin: null, stockNumber: "STK001" });
    // stockNumber is lowercased when included in the slug parts
    expect(slug).toBe("stk001");
  });

  it("uses vin last 6 when vin is present", () => {
    const slug = vehicleToSlug({ year: 2020, make: "Ford", model: "F-150", trim: null, vin: "1FTFW1E80NFA12345", stockNumber: "FALLBACK" });
    expect(slug).toContain("a12345");
  });

  it("sanitizes special chars in make/model", () => {
    const slug = vehicleToSlug({ year: 2022, make: "Land Rover", model: "Range Rover Sport", trim: null, vin: "ABCDEF123456", stockNumber: "X" });
    expect(slug).not.toMatch(/\s/);
    expect(slug).toMatch(/^[a-z0-9-]+$/);
  });
});

describe("serializePublicVehicleSummary", () => {
  it("does NOT expose internal UUIDs (id, dealershipId, vehicleId)", () => {
    const result = serializePublicVehicleSummary(vehicleWithSettings);
    const json = JSON.stringify(result);
    expect(json).not.toContain("v-secret-uuid");
    expect(json).not.toContain("d-secret-dealership-uuid");
    expect(json).not.toContain("ws-secret-uuid");
  });

  it("does NOT expose purchase price (internal cost data)", () => {
    const result = serializePublicVehicleSummary(vehicleWithSettings);
    const json = JSON.stringify(result);
    expect(json).not.toContain("2000000");
    expect(json).not.toContain("purchasePrice");
  });

  it("exposes sale price as string cents when hidePrice=false", () => {
    const result = serializePublicVehicleSummary(vehicleWithSettings);
    expect(result.price).toBe("2999900");
  });

  it("hides price when hidePrice=true", () => {
    const v = { ...vehicleWithSettings, websiteSettings: { ...BASE_SETTINGS, hidePrice: true } };
    const result = serializePublicVehicleSummary(v);
    expect(result.price).toBeNull();
  });

  it("exposes slug, not internal id", () => {
    const result = serializePublicVehicleSummary(vehicleWithSettings);
    expect(result.slug).toBeDefined();
    expect(result.slug).toMatch(/^[a-z0-9-]+$/);
    expect("id" in result).toBe(false);
  });

  it("returns only vinPartial (last 6) for VDP, not full VIN", () => {
    const detailResult = serializePublicVehicleDetail({
      ...vehicleWithSettings,
      vinDecodes: [],
    });
    expect(detailResult.vinPartial).toBe("123456");
    expect(JSON.stringify(detailResult)).not.toContain("1HGCM82633A");
  });
});

describe("serializePublicVehicleDetail", () => {
  const detailVehicle = {
    ...vehicleWithSettings,
    vinDecodes: [{ bodyStyle: "Sedan", engine: "2.0L I4", transmission: "CVT", drivetrain: "FWD" }],
  };

  it("does NOT expose deletedAt, createdAt, updatedAt", () => {
    const result = serializePublicVehicleDetail(detailVehicle);
    const json = JSON.stringify(result);
    expect(json).not.toContain("deletedAt");
    expect(json).not.toContain("createdAt");
    expect(json).not.toContain("updatedAt");
  });

  it("includes engine/transmission/drivetrain from vinDecode", () => {
    const result = serializePublicVehicleDetail(detailVehicle);
    expect(result.engine).toBe("2.0L I4");
    expect(result.transmission).toBe("CVT");
    expect(result.drivetrain).toBe("FWD");
  });

  it("limits photos to max 20", () => {
    const manyPhotos = Array.from({ length: 30 }, (_, i) => ({
      id: `photo-${i}`,
      vehicleId: "v-secret-uuid",
      dealershipId: "d-secret-dealership-uuid",
      fileObjectId: `fobj-${i}`,
      sortOrder: i,
      isPrimary: i === 0,
    }));
    const v = { ...vehicleWithSettings, vehiclePhotos: manyPhotos };
    const result = serializePublicVehicleDetail({ ...v, vinDecodes: [] });
    expect(result.photos.length).toBeLessThanOrEqual(20);
  });
});
