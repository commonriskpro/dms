/** @jest-environment node */
jest.mock("@/lib/api/handler", () => {
  const actual = jest.requireActual<typeof import("@/lib/api/handler")>("@/lib/api/handler");
  return {
    ...actual,
    getAuthContext: jest.fn(),
    guardPermission: jest.fn().mockResolvedValue(undefined),
  };
});

jest.mock("@/modules/crm-pipeline-automation/service/command-center", () => ({
  getCommandCenterData: jest.fn(),
}));

import { getAuthContext, guardPermission } from "@/lib/api/handler";
import { ApiError } from "@/lib/auth";
import * as commandCenterService from "@/modules/crm-pipeline-automation/service/command-center";
import { GET } from "./route";
import type { NextRequest } from "next/server";

const ctx = {
  userId: "user-1",
  email: "u@test.local",
  dealershipId: "dealership-1",
  permissions: ["crm.read"],
};

describe("GET /api/crm/command-center", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthContext as jest.Mock).mockResolvedValue(ctx);
    (guardPermission as jest.Mock).mockResolvedValue(undefined);
    (commandCenterService.getCommandCenterData as jest.Mock).mockResolvedValue({
      kpis: {
        openOpportunities: 1,
        dueNow: 1,
        staleProspects: 0,
        blockers: 0,
        waitingConversations: 1,
        sequenceExceptions: 0,
      },
      filters: { owners: [], stages: [], sources: [] },
      pressure: {
        overdueTasks: 0,
        callbacksDueToday: 0,
        inboundWaiting: 1,
        noNextAction: 0,
        failedJobs: 0,
      },
      pipeline: { stages: [] },
      sections: {
        dueNow: [],
        staleProspects: [],
        pipelineBlockers: [],
        sequenceExceptions: [],
      },
    });
  });

  function request(searchParams?: string): NextRequest {
    const url = searchParams
      ? `https://example.com/api/crm/command-center?${searchParams}`
      : "https://example.com/api/crm/command-center";
    return { nextUrl: new URL(url), url } as unknown as NextRequest;
  }

  it("returns 403 when crm.read is denied", async () => {
    (guardPermission as jest.Mock).mockRejectedValue(
      new ApiError("FORBIDDEN", "Insufficient permission")
    );

    const response = await GET(request());
    expect(response.status).toBe(403);
    expect(commandCenterService.getCommandCenterData).not.toHaveBeenCalled();
  });

  it("returns command center data with normalized query inputs", async () => {
    const response = await GET(
      request(
        "scope=mine&ownerId=11111111-1111-1111-1111-111111111111&stageId=22222222-2222-2222-2222-222222222222&status=OPEN&source=web&q=alice"
      )
    );

    expect(response.status).toBe(200);
    expect(commandCenterService.getCommandCenterData).toHaveBeenCalledWith(
      ctx.dealershipId,
      ctx.userId,
      {
        scope: "mine",
        ownerId: "11111111-1111-1111-1111-111111111111",
        stageId: "22222222-2222-2222-2222-222222222222",
        status: "OPEN",
        source: "web",
        q: "alice",
      }
    );
    const json = await response.json();
    expect(json.data.kpis.openOpportunities).toBe(1);
  });

  it("returns 400 for invalid query parameters", async () => {
    const response = await GET(request("ownerId=not-a-uuid"));
    expect(response.status).toBe(400);
    expect(commandCenterService.getCommandCenterData).not.toHaveBeenCalled();
  });
});
