import { render } from "@testing-library/react";

jest.mock("next/cache", () => ({
  unstable_noStore: jest.fn(),
}));

jest.mock("@/modules/crm-pipeline-automation/ui/OpportunitiesWorkspacePage", () => ({
  OpportunitiesWorkspacePage: jest.fn(() => null),
}));
jest.mock("@/lib/api/handler", () => ({
  getSessionContextOrNull: jest.fn(),
}));
jest.mock("@/modules/crm-pipeline-automation/service/opportunities-view-preference", () => ({
  getOpportunitiesViewPreference: jest.fn(),
}));

import { OpportunitiesWorkspacePage } from "@/modules/crm-pipeline-automation/ui/OpportunitiesWorkspacePage";
import { getSessionContextOrNull } from "@/lib/api/handler";
import { getOpportunitiesViewPreference } from "@/modules/crm-pipeline-automation/service/opportunities-view-preference";
import Page from "../page";

describe("CRM opportunities route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSessionContextOrNull as jest.Mock).mockResolvedValue({
      activeDealershipId: "dealership-1",
      userId: "user-1",
    });
    (getOpportunitiesViewPreference as jest.Mock).mockResolvedValue("board");
  });

  it("passes normalized initial query state into the shared workspace", async () => {
    const element = await Page({
      searchParams: Promise.resolve({
        view: "list",
        scope: "mine",
        customerId: "customer-9",
        pipelineId: "pipeline-1",
        stageId: "stage-2",
        ownerId: "owner-3",
        status: "OPEN",
        source: "web",
        q: "alice",
        page: "3",
        pageSize: "50",
        sortBy: "createdAt",
        sortOrder: "asc",
      }),
    });
    render(element);

    expect(OpportunitiesWorkspacePage).toHaveBeenCalledWith(
      expect.objectContaining({
        initialQuery: expect.objectContaining({
          view: "list",
          scope: "mine",
          customerId: "customer-9",
          pipelineId: "pipeline-1",
          stageId: "stage-2",
          ownerId: "owner-3",
          status: "OPEN",
          source: "web",
          q: "alice",
          page: 3,
          pageSize: 50,
          sortBy: "createdAt",
          sortOrder: "asc",
        }),
      }),
      undefined
    );
  });

  it("falls back to board and all scope for invalid query values", async () => {
    const element = await Page({
      searchParams: Promise.resolve({
        view: "bad",
        scope: "bad",
      }),
    });
    render(element);

    expect(OpportunitiesWorkspacePage).toHaveBeenCalledWith(
      expect.objectContaining({
        initialQuery: expect.objectContaining({
          view: "board",
          scope: "all",
          page: 1,
          pageSize: 25,
        }),
      }),
      undefined
    );
  });

  it("uses the saved preference when view is omitted", async () => {
    (getOpportunitiesViewPreference as jest.Mock).mockResolvedValue("list");

    const element = await Page({
      searchParams: Promise.resolve({
        scope: "all",
      }),
    });
    render(element);

    expect(getOpportunitiesViewPreference).toHaveBeenCalledWith({
      dealershipId: "dealership-1",
      userId: "user-1",
    });
    expect(OpportunitiesWorkspacePage).toHaveBeenCalledWith(
      expect.objectContaining({
        initialQuery: expect.objectContaining({
          view: "list",
        }),
      }),
      undefined
    );
  });
});
