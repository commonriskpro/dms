/** @jest-environment node */
/**
 * GET/PATCH /api/onboarding: auth, permission, single-action validation, dealership scoping.
 */
jest.mock("@/lib/api/handler", () => ({
  getAuthContext: jest.fn(),
  guardPermission: jest.fn(),
  handleApiError: jest.fn((e: unknown) => {
    const err = e as { status?: number; code?: string };
    return Response.json(
      { error: { code: err.code ?? "INTERNAL", message: "Error" } },
      { status: err.status ?? 500 }
    );
  }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}));

jest.mock("@/modules/onboarding/service/onboarding", () => ({
  getOrCreateState: jest.fn(),
  advanceStep: jest.fn(),
  completeStep: jest.fn(),
  skipStep: jest.fn(),
  setInventoryPathChosen: jest.fn(),
  markOnboardingComplete: jest.fn(),
}));

import { NextRequest } from "next/server";
import { getAuthContext, guardPermission } from "@/lib/api/handler";
import * as onboardingService from "@/modules/onboarding/service/onboarding";
import { GET, PATCH } from "./route";

const mockGetAuthContext = getAuthContext as jest.Mock;
const mockGuardPermission = guardPermission as jest.Mock;

function mockCtx() {
  mockGetAuthContext.mockResolvedValue({
    userId: "u1",
    email: "u@example.com",
    dealershipId: "d1",
    permissions: ["admin.dealership.read", "admin.dealership.write"],
  });
  mockGuardPermission.mockResolvedValue(undefined);
}

const defaultState = {
  id: "ob1",
  dealershipId: "d1",
  currentStep: 1,
  completedSteps: [] as number[],
  skippedSteps: [] as number[],
  inventoryPathChosen: null as string | null,
  isComplete: false,
  completedAt: null as Date | null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("GET /api/onboarding", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCtx();
    (onboardingService.getOrCreateState as jest.Mock).mockResolvedValue(defaultState);
  });

  it("returns onboarding state for ctx.dealershipId", async () => {
    const req = new NextRequest("http://localhost/api/onboarding");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.onboarding).toBeDefined();
    expect(json.onboarding.dealershipId).toBe("d1");
    expect(json.onboarding.currentStep).toBe(1);
    expect(onboardingService.getOrCreateState).toHaveBeenCalledWith("d1");
  });

  it("calls guardPermission with admin.dealership.read", async () => {
    const req = new NextRequest("http://localhost/api/onboarding");
    await GET(req);
    expect(mockGuardPermission).toHaveBeenCalledWith(
      expect.objectContaining({ dealershipId: "d1" }),
      "admin.dealership.read"
    );
  });
});

describe("PATCH /api/onboarding", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCtx();
    (onboardingService.getOrCreateState as jest.Mock).mockResolvedValue(defaultState);
    (onboardingService.advanceStep as jest.Mock).mockResolvedValue({
      ...defaultState,
      currentStep: 2,
    });
    (onboardingService.completeStep as jest.Mock).mockResolvedValue({
      ...defaultState,
      currentStep: 2,
      completedSteps: [1],
    });
    (onboardingService.skipStep as jest.Mock).mockResolvedValue({
      ...defaultState,
      currentStep: 3,
      skippedSteps: [2],
    });
    (onboardingService.setInventoryPathChosen as jest.Mock).mockResolvedValue({
      ...defaultState,
      currentStep: 4,
      inventoryPathChosen: "add_first",
    });
    (onboardingService.markOnboardingComplete as jest.Mock).mockResolvedValue({
      ...defaultState,
      isComplete: true,
      currentStep: 6,
      completedAt: new Date(),
    });
  });

  it("completeStep calls service with ctx.dealershipId", async () => {
    const req = new NextRequest("http://localhost/api/onboarding", {
      method: "PATCH",
      body: JSON.stringify({ completeStep: 1 }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    expect(onboardingService.completeStep).toHaveBeenCalledWith("d1", 1);
  });

  it("skipStep calls service with ctx.dealershipId", async () => {
    const req = new NextRequest("http://localhost/api/onboarding", {
      method: "PATCH",
      body: JSON.stringify({ skipStep: 2 }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    expect(onboardingService.skipStep).toHaveBeenCalledWith("d1", 2);
  });

  it("markComplete: true calls markOnboardingComplete", async () => {
    const req = new NextRequest("http://localhost/api/onboarding", {
      method: "PATCH",
      body: JSON.stringify({ markComplete: true }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    expect(onboardingService.markOnboardingComplete).toHaveBeenCalledWith("d1");
  });

  it("inventoryPathChosen calls setInventoryPathChosen", async () => {
    const req = new NextRequest("http://localhost/api/onboarding", {
      method: "PATCH",
      body: JSON.stringify({ inventoryPathChosen: "later" }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    expect(onboardingService.setInventoryPathChosen).toHaveBeenCalledWith("d1", "later");
  });

  it("returns 400 when multiple actions in body", async () => {
    const req = new NextRequest("http://localhost/api/onboarding", {
      method: "PATCH",
      body: JSON.stringify({ completeStep: 1, skipStep: 2 }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error?.code).toBe("VALIDATION_ERROR");
  });
});
