/** @jest-environment node */
/**
 * Inventory acquisition & pricing: appraisal conversion, acquisition stages,
 * auction mock, valuation, pricing preview/apply, publish readiness, RBAC/tenant isolation.
 */
import { ApiError } from "@/lib/auth";
import * as appraisalService from "../service/appraisal";
import * as acquisitionService from "../service/acquisition";
import * as auctionService from "../service/auction";
import * as valuationService from "../service/valuation-engine";
import * as pricingService from "../service/pricing";
import * as listingsService from "../service/listings";

jest.mock("@/lib/tenant-status", () => ({
  requireTenantActiveForRead: jest.fn().mockResolvedValue(undefined),
  requireTenantActiveForWrite: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../db/appraisal");
jest.mock("../db/acquisition");
jest.mock("../db/auction-cache");
jest.mock("../db/vehicle");
jest.mock("../db/vehicle-market-valuation");
jest.mock("../db/book-values");
jest.mock("../db/pricing-rule");
jest.mock("../db/vehicle-listing");
jest.mock("../db/vehicle-photo");
jest.mock("../service/price-to-market", () => ({
  getPriceToMarketForVehicle: jest.fn().mockResolvedValue({
    marketStatus: "At Market",
    marketDeltaCents: 0,
    marketDeltaPercent: 0,
    sourceLabel: "Internal comps",
  }),
  computeDaysInStock: jest.fn().mockReturnValue(30),
}));
jest.mock("@/lib/audit", () => ({ auditLog: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/lib/infrastructure/events/eventBus", () => ({ emitEvent: jest.fn() }));

const dealershipId = "d1000000-0000-0000-0000-000000000001";
const otherDealershipId = "d2000000-0000-0000-0000-000000000002";
const userId = "u1000000-0000-0000-0000-000000000001";
const appraisalId = "ap100000-0000-0000-0000-000000000001";
const vehicleId = "v1000000-0000-0000-0000-000000000001";
const leadId = "l1000000-0000-0000-0000-000000000001";

describe("Appraisal conversion", () => {
  it("convertAppraisalToInventory creates vehicle and links appraisal", async () => {
    const vehicleDb = require("../db/vehicle");
    const appraisalDb = require("../db/appraisal");
    vehicleDb.getVehicleById.mockResolvedValue(null);
    vehicleDb.findActiveVehicleByVin.mockResolvedValue(null);
    vehicleDb.findActiveVehicleByStockNumber.mockResolvedValue(null);
    vehicleDb.createVehicle.mockResolvedValue({
      id: vehicleId,
      dealershipId,
      vin: "1HGBH41JXMN109186",
      stockNumber: "APP-AP10000",
      salePriceCents: BigInt(2000000),
      status: "AVAILABLE",
    });
    appraisalDb.getAppraisalById.mockResolvedValue({
      id: appraisalId,
      dealershipId,
      vin: "1HGBH41JXMN109186",
      sourceType: "AUCTION",
      status: "APPROVED",
      vehicleId: null,
      expectedRetailCents: BigInt(2000000),
      acquisitionCostCents: BigInt(1800000),
      transportEstimateCents: BigInt(0),
      reconEstimateCents: BigInt(0),
      feesEstimateCents: BigInt(0),
    });
    appraisalDb.setAppraisalVehicleId.mockResolvedValue({});

    const result = await appraisalService.convertAppraisalToInventory(dealershipId, userId, appraisalId);
    expect(result.vehicle).toBeDefined();
    expect(result.appraisal).toBeDefined();
    expect(vehicleDb.createVehicle).toHaveBeenCalledWith(dealershipId, expect.objectContaining({
      vin: "1HGBH41JXMN109186",
      salePriceCents: BigInt(2000000),
    }));
    expect(appraisalDb.setAppraisalVehicleId).toHaveBeenCalledWith(dealershipId, appraisalId, vehicleId);
  });

  it("convertAppraisalToInventory rejects REJECTED appraisal", async () => {
    const appraisalDb = require("../db/appraisal");
    appraisalDb.getAppraisalById.mockResolvedValue({
      id: appraisalId,
      dealershipId,
      vin: "1HGBH41JXMN109186",
      status: "REJECTED",
      vehicleId: null,
    });
    await expect(
      appraisalService.convertAppraisalToInventory(dealershipId, userId, appraisalId)
    ).rejects.toThrow(ApiError);
  });
});

describe("Acquisition stage moves", () => {
  it("moveInventorySourceLeadStage updates status", async () => {
    const acquisitionDb = require("../db/acquisition");
    acquisitionDb.setInventorySourceLeadStatus.mockResolvedValue({
      id: leadId,
      status: "CONTACTED",
    });
    const result = await acquisitionService.moveInventorySourceLeadStage(
      dealershipId,
      leadId,
      "CONTACTED"
    );
    expect(result.status).toBe("CONTACTED");
  });

  it("moveInventorySourceLeadStage rejects invalid stage", async () => {
    await expect(
      acquisitionService.moveInventorySourceLeadStage(dealershipId, leadId, "INVALID" as "NEW")
    ).rejects.toThrow(ApiError);
  });
});

describe("Auction mock provider", () => {
  it("searchAuctionListings returns only MOCK provider and caches", async () => {
    const auctionCacheDb = require("../db/auction-cache");
    auctionCacheDb.upsertAuctionListingCache.mockResolvedValue({
      id: "auc-1",
      provider: "MOCK",
      auctionLotId: "MOCK-LOT-1",
      vin: "1HGBH41JXMN109186",
      year: 2022,
      make: "Honda",
      model: "Accord",
    });
    const data = await auctionService.searchAuctionListings(dealershipId, { vin: "1HGBH41JXMN109186" }, 10);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].provider).toBe("MOCK");
  });

  it("searchAuctionListings rejects non-MOCK provider", async () => {
    await expect(
      auctionService.searchAuctionListings(dealershipId, { provider: "MANHEIM" }, 10)
    ).rejects.toThrow(ApiError);
  });
});

describe("Valuation", () => {
  it("getVehicleValuation returns null when no snapshot", async () => {
    const vehicleDb = require("../db/vehicle");
    const vehicleMarketValuationDb = require("../db/vehicle-market-valuation");
    vehicleDb.getVehicleById.mockResolvedValue({ id: vehicleId, dealershipId });
    vehicleMarketValuationDb.getLatestVehicleMarketValuation.mockResolvedValue(null);
    const result = await valuationService.getVehicleValuation(dealershipId, vehicleId);
    expect(result).toBeNull();
  });

  it("recalculateVehicleValuation creates snapshot", async () => {
    const vehicleDb = require("../db/vehicle");
    const vehicleMarketValuationDb = require("../db/vehicle-market-valuation");
    vehicleDb.getVehicleById.mockResolvedValue({
      id: vehicleId,
      dealershipId,
      salePriceCents: BigInt(2000000),
      make: "Honda",
      model: "Accord",
      createdAt: new Date(),
    });
    vehicleMarketValuationDb.createVehicleMarketValuation.mockResolvedValue({
      id: "val-1",
      vehicleId,
      marketAverageCents: 2000000,
      recommendedRetailCents: 2000000,
    });
    const result = await valuationService.recalculateVehicleValuation(dealershipId, vehicleId);
    expect(result).toBeDefined();
    expect(vehicleMarketValuationDb.createVehicleMarketValuation).toHaveBeenCalled();
  });
});

describe("Pricing preview and apply", () => {
  it("previewVehiclePriceAdjustment returns steps and suggested price", async () => {
    const vehicleDb = require("../db/vehicle");
    const pricingRuleDb = require("../db/pricing-rule");
    vehicleDb.getVehicleById.mockResolvedValue({
      id: vehicleId,
      dealershipId,
      salePriceCents: BigInt(2000000),
      createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
    });
    pricingRuleDb.listPricingRules.mockResolvedValue([
      {
        id: "rule-1",
        name: "30-day",
        ruleType: "AGE_BASED",
        daysInStock: 30,
        adjustmentPercent: -2,
        adjustmentCents: null,
        enabled: true,
      },
    ]);
    const preview = await pricingService.previewVehiclePriceAdjustment(dealershipId, vehicleId);
    expect(preview.vehicleId).toBe(vehicleId);
    expect(preview.currentPriceCents).toBe(2000000);
    expect(Array.isArray(preview.steps)).toBe(true);
  });

  it("applyVehiclePriceAdjustment persists and audits", async () => {
    const vehicleDb = require("../db/vehicle");
    const pricingRuleDb = require("../db/pricing-rule");
    vehicleDb.getVehicleById.mockResolvedValue({
      id: vehicleId,
      dealershipId,
      salePriceCents: BigInt(2000000),
      createdAt: new Date(),
    });
    vehicleDb.updateVehicle.mockResolvedValue({ id: vehicleId, salePriceCents: BigInt(1960000) });
    pricingRuleDb.listPricingRules.mockResolvedValue([]);
    const result = await pricingService.applyVehiclePriceAdjustment(dealershipId, userId, vehicleId);
    expect(result.vehicle).toBeDefined();
    expect(result.preview).toBeDefined();
  });
});

describe("Publish readiness", () => {
  it("publishVehicleToPlatform throws when vehicle has no price", async () => {
    const vehicleDb = require("../db/vehicle");
    vehicleDb.getVehicleById.mockResolvedValue({
      id: vehicleId,
      dealershipId,
      salePriceCents: BigInt(0),
      vin: "1HGBH41JXMN109186",
      stockNumber: "STK1",
    });
    await expect(
      listingsService.publishVehicleToPlatform(dealershipId, vehicleId, "WEBSITE")
    ).rejects.toThrow(ApiError);
  });

  it("publishVehicleToPlatform throws when requirePhoto and no photos", async () => {
    const vehicleDb = require("../db/vehicle");
    const vehiclePhotoDb = require("../db/vehicle-photo");
    vehicleDb.getVehicleById.mockResolvedValue({
      id: vehicleId,
      dealershipId,
      salePriceCents: BigInt(2000000),
      vin: "1HGBH41JXMN109186",
      stockNumber: "STK1",
    });
    vehiclePhotoDb.listVehiclePhotosWithOrder.mockResolvedValue([]);
    await expect(
      listingsService.publishVehicleToPlatform(dealershipId, vehicleId, "WEBSITE", { requirePhoto: true })
    ).rejects.toThrow(ApiError);
  });

  it("publishVehicleToPlatform throws when vehicle has no VIN and no stock number", async () => {
    const vehicleDb = require("../db/vehicle");
    vehicleDb.getVehicleById.mockResolvedValue({
      id: vehicleId,
      dealershipId,
      salePriceCents: BigInt(2000000),
      vin: null,
      stockNumber: "",
    });
    await expect(
      listingsService.publishVehicleToPlatform(dealershipId, vehicleId, "WEBSITE")
    ).rejects.toThrow(ApiError);
  });
});

describe("Tenant isolation", () => {
  it("getAppraisal with wrong dealership throws NOT_FOUND", async () => {
    const appraisalDb = require("../db/appraisal");
    appraisalDb.getAppraisalById.mockResolvedValue(null);
    await expect(appraisalService.getAppraisal(otherDealershipId, appraisalId)).rejects.toThrow(ApiError);
  });

  it("getInventorySourceLead with wrong dealership throws NOT_FOUND", async () => {
    const acquisitionDb = require("../db/acquisition");
    acquisitionDb.getInventorySourceLeadById.mockResolvedValue(null);
    await expect(
      acquisitionService.getInventorySourceLead(otherDealershipId, leadId)
    ).rejects.toThrow(ApiError);
  });

  it("createInventorySourceLead with cross-tenant appraisalId throws VALIDATION_ERROR", async () => {
    const acquisitionDb = require("../db/acquisition");
    const appraisalDb = require("../db/appraisal");
    appraisalDb.getAppraisalById.mockResolvedValue(null); // other tenant's appraisal not found in this dealership
    acquisitionDb.createInventorySourceLead.mockResolvedValue({ id: leadId, status: "NEW" });
    await expect(
      acquisitionService.createInventorySourceLead(dealershipId, {
        vin: "1HGBH41JXMN109186",
        sourceType: "AUCTION",
        appraisalId: "ap-other-tenant-00000000000001",
      })
    ).rejects.toThrow(ApiError);
    expect(acquisitionDb.createInventorySourceLead).not.toHaveBeenCalled();
  });

  it("updateInventorySourceLead with cross-tenant appraisalId throws VALIDATION_ERROR", async () => {
    const acquisitionDb = require("../db/acquisition");
    const appraisalDb = require("../db/appraisal");
    appraisalDb.getAppraisalById.mockResolvedValue(null);
    await expect(
      acquisitionService.updateInventorySourceLead(dealershipId, leadId, {
        appraisalId: "ap-other-tenant-00000000000001",
      })
    ).rejects.toThrow(ApiError);
    expect(acquisitionDb.updateInventorySourceLead).not.toHaveBeenCalled();
  });
});

describe("Appraisal workflow safety", () => {
  it("convertAppraisalToInventory when already CONVERTED throws CONFLICT", async () => {
    const appraisalDb = require("../db/appraisal");
    appraisalDb.getAppraisalById.mockResolvedValue({
      id: appraisalId,
      dealershipId,
      vin: "1HGBH41JXMN109186",
      status: "CONVERTED",
      vehicleId: "v1000000-0000-0000-0000-000000000001",
    });
    await expect(
      appraisalService.convertAppraisalToInventory(dealershipId, userId, appraisalId)
    ).rejects.toThrow(ApiError);
  });
});

describe("Pricing engine safety", () => {
  it("preview never returns negative suggestedPriceCents", async () => {
    const vehicleDb = require("../db/vehicle");
    const pricingRuleDb = require("../db/pricing-rule");
    vehicleDb.getVehicleById.mockResolvedValue({
      id: vehicleId,
      dealershipId,
      salePriceCents: BigInt(100000),
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    });
    pricingRuleDb.listPricingRules.mockResolvedValue([
      {
        id: "rule-1",
        name: "aggressive",
        ruleType: "AGE_BASED",
        daysInStock: 30,
        adjustmentPercent: -100,
        adjustmentCents: -50000,
        enabled: true,
      },
    ]);
    const preview = await pricingService.previewVehiclePriceAdjustment(dealershipId, vehicleId);
    expect(preview.suggestedPriceCents).toBeGreaterThanOrEqual(0);
  });

  it("only enabled rules are applied in preview", async () => {
    const vehicleDb = require("../db/vehicle");
    const pricingRuleDb = require("../db/pricing-rule");
    vehicleDb.getVehicleById.mockResolvedValue({
      id: vehicleId,
      dealershipId,
      salePriceCents: BigInt(2000000),
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    });
    pricingRuleDb.listPricingRules.mockResolvedValue([
      {
        id: "rule-1",
        name: "disabled",
        ruleType: "AGE_BASED",
        daysInStock: 30,
        adjustmentPercent: -10,
        adjustmentCents: null,
        enabled: false,
      },
    ]);
    const preview = await pricingService.previewVehiclePriceAdjustment(dealershipId, vehicleId);
    expect(preview.steps).toHaveLength(0);
    expect(preview.suggestedPriceCents).toBe(2000000);
  });
});

describe("Listings / unpublish", () => {
  it("unpublishVehicleListing returns listing or null when not found", async () => {
    const vehicleDb = require("../db/vehicle");
    const vehicleListingDb = require("../db/vehicle-listing");
    vehicleDb.getVehicleById.mockResolvedValue({
      id: vehicleId,
      dealershipId,
      salePriceCents: BigInt(2000000),
      vin: "1HGBH41JXMN109186",
      stockNumber: "STK1",
    });
    vehicleListingDb.setVehicleListingStatus.mockResolvedValue(undefined);
    vehicleListingDb.getVehicleListingByPlatform.mockResolvedValue(null);
    const result = await listingsService.unpublishVehicleListing(
      dealershipId,
      vehicleId,
      "WEBSITE"
    );
    expect(result).toBeNull();
  });
});
