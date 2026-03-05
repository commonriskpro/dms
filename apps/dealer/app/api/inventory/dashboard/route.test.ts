/**
 * GET /api/inventory/dashboard: RBAC (403 without inventory.read); 200 with data shape when permitted.
 */
jest.mock("@/lib/api/handler", () => {
  const actual = jest.requireActual<typeof import("@/lib/api/handler")>("@/lib/api/handler");
  return {
    ...actual,
    getAuthContext: jest.fn(),
    guardPermission: jest.fn().mockResolvedValue(undefined),
  };
});

jest.mock("@/modules/inventory/service/dashboard", () => ({
  getKpis: jest.fn().mockResolvedValue({
    totalUnits: 0,
    delta7d: null,
    inReconUnits: 0,
    inReconPercent: 0,
    salePendingUnits: 0,
    salePendingValueCents: null,
    inventoryValueCents: 0,
    avgValueCents: 0,
  }),
  getAgingBuckets: jest.fn().mockResolvedValue({ lt30: 0, d30to60: 0, d60to90: 0, gt90: 0 }),
  getAlertCounts: jest.fn().mockResolvedValue({ missingPhotos: 0, stale: 0, reconOverdue: 0 }),
}));
jest.mock("@/modules/deals/service/deal-pipeline", () => ({
  getDealPipeline: jest.fn().mockResolvedValue({
    leads: 0,
    appointments: 0,
    workingDeals: 0,
    pendingFunding: 0,
    soldToday: 0,
  }),
}));
jest.mock("@/modules/customers/service/team-activity", () => ({
  getTeamActivityToday: jest.fn().mockResolvedValue({
    callsLogged: 0,
    appointmentsSet: 0,
    notesAdded: 0,
    callbacksScheduled: 0,
    dealsStarted: 0,
  }),
}));

import { getAuthContext, guardPermission } from "@/lib/api/handler";
import { ApiError } from "@/lib/auth";
import { GET } from "./route";
import type { NextRequest } from "next/server";

const ctx = {
  userId: "user-1",
  email: "u@test.local",
  dealershipId: "dealership-1",
  permissions: ["inventory.read"],
};

function makeRequest(): NextRequest {
  return { nextUrl: new URL("http://localhost/api/inventory/dashboard"), headers: new Headers() } as unknown as NextRequest;
}

describe("GET /api/inventory/dashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(ctx);
    (guardPermission as jest.Mock).mockResolvedValue(undefined);
  });

  it("returns 403 when guardPermission throws FORBIDDEN", async () => {
    (guardPermission as jest.Mock).mockRejectedValue(new ApiError("FORBIDDEN", "Insufficient permission"));
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error?.code).toBe("FORBIDDEN");
  });

  it("returns 200 with data.initialKpis, initialAging, initialAlerts, initialPipeline, initialTeam when permitted", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(body.data.initialKpis).toBeDefined();
    expect(body.data.initialAging).toBeDefined();
    expect(body.data.initialAlerts).toBeDefined();
    expect(Array.isArray(body.data.initialAlerts)).toBe(true);
    expect(body.data.initialPipeline).toBeDefined();
    expect(body.data.initialTeam).toBeDefined();
    expect(body.data.initialAlerts[0]).toMatchObject({ id: expect.any(String), label: expect.any(String), count: expect.any(Number), href: expect.any(String) });
  });
});
