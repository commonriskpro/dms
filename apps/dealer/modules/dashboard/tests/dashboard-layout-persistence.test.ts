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
  saveLayout,
  resetLayout,
} from "../service/dashboard-layout-persistence";

const dealershipId = "550e8400-e29b-41d4-a716-446655440000";
const userId = "660e8400-e29b-41d4-a716-446655440000";

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

describe("saveLayout", () => {
  it("upserts with correct params", async () => {
    (prisma.dashboardLayoutPreference.upsert as jest.Mock).mockResolvedValue(undefined);
    const payload = {
      version: 1 as const,
      widgets: [
        { widgetId: "metrics-inventory", visible: true, zone: "topRow" as const, order: 0 },
      ],
    };
    await saveLayout({ dealershipId, userId, payload });
    expect(prisma.dashboardLayoutPreference.upsert).toHaveBeenCalledWith({
      where: {
        dealershipId_userId: { dealershipId, userId },
      },
      create: {
        dealershipId,
        userId,
        layoutJson: payload,
      },
      update: {
        layoutJson: payload,
      },
    });
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
