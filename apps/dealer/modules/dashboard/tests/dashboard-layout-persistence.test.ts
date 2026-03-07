/** @jest-environment node */
/**
 * Dashboard layout persistence: getSavedLayout, saveLayout, resetLayout.
 * Uses mocked prisma.
 */
jest.mock("@/lib/db", () => ({
  prisma: {
    dashboardLayoutPreference: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import {
  getSavedLayout,
  getSavedLayoutRow,
  saveLayout,
  resetLayout,
} from "../service/dashboard-layout-persistence";

const dealershipId = "550e8400-e29b-41d4-a716-446655440000";
const userId = "660e8400-e29b-41d4-a716-446655440000";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("getSavedLayout", () => {
  it("returns null when no row", async () => {
    (prisma.dashboardLayoutPreference.findUnique as jest.Mock).mockResolvedValue(null);
    const result = await getSavedLayout({ dealershipId, userId });
    expect(result).toBeNull();
    expect(prisma.dashboardLayoutPreference.findUnique).toHaveBeenCalledWith({
      where: {
        dealershipId_userId: { dealershipId, userId },
      },
      select: { layoutJson: true },
    });
  });

  it("returns layoutJson when row exists", async () => {
    const layoutJson = { version: 1, widgets: [] };
    (prisma.dashboardLayoutPreference.findUnique as jest.Mock).mockResolvedValue({
      layoutJson,
    });
    const result = await getSavedLayout({ dealershipId, userId });
    expect(result).toEqual(layoutJson);
  });
});

describe("getSavedLayoutRow", () => {
  it("returns layoutJson and checksum when row exists", async () => {
    (prisma.dashboardLayoutPreference.findUnique as jest.Mock).mockResolvedValue({
      layoutJson: { version: 1, widgets: [] },
      checksum: "abc64",
    });
    const result = await getSavedLayoutRow({ dealershipId, userId });
    expect(result).toEqual({ layoutJson: { version: 1, widgets: [] }, checksum: "abc64" });
    expect(prisma.dashboardLayoutPreference.findUnique).toHaveBeenCalledWith({
      where: { dealershipId_userId: { dealershipId, userId } },
      select: { layoutJson: true, checksum: true },
    });
  });
});

describe("saveLayout", () => {
  it("upserts with correct params when no existing row or checksum differs", async () => {
    (prisma.dashboardLayoutPreference.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.dashboardLayoutPreference.upsert as jest.Mock).mockResolvedValue(undefined);
    const payload = {
      version: 1 as const,
      widgets: [
        { widgetId: "metrics-inventory", visible: true, zone: "topRow" as const, order: 0 },
      ],
    };
    const checksum = "abc123";
    const wrote = await saveLayout({ dealershipId, userId, payload, checksum });
    expect(wrote).toBe(true);
    expect(prisma.dashboardLayoutPreference.upsert).toHaveBeenCalledWith({
      where: {
        dealershipId_userId: { dealershipId, userId },
      },
      create: {
        dealershipId,
        userId,
        layoutJson: payload,
        checksum,
      },
      update: {
        layoutJson: payload,
        checksum,
      },
    });
  });

  it("skips upsert when existing checksum matches (no-op)", async () => {
    (prisma.dashboardLayoutPreference.findUnique as jest.Mock).mockResolvedValue({
      layoutJson: {},
      checksum: "same-checksum",
    });
    const payload = {
      version: 1 as const,
      widgets: [
        { widgetId: "metrics-inventory", visible: true, zone: "topRow" as const, order: 0 },
      ],
    };
    const wrote = await saveLayout({
      dealershipId,
      userId,
      payload,
      checksum: "same-checksum",
    });
    expect(wrote).toBe(false);
    expect(prisma.dashboardLayoutPreference.upsert).not.toHaveBeenCalled();
  });
});

describe("resetLayout", () => {
  it("deletes by dealershipId and userId", async () => {
    (prisma.dashboardLayoutPreference.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
    await resetLayout({ dealershipId, userId });
    expect(prisma.dashboardLayoutPreference.deleteMany).toHaveBeenCalledWith({
      where: { dealershipId, userId },
    });
  });
});
