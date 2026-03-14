/**
 * Sales page server component: redirect when no session / no dealership / no access;
 * when allowed, fetches command center (scope=mine) and my tasks and renders SalesHubClient.
 */
jest.mock("next/cache", () => ({
  noStore: jest.fn(),
  unstable_noStore: jest.fn(),
}));

const mockRedirect = jest.fn((url: string) => {
  const err = new Error("NEXT_REDIRECT");
  (err as unknown as { digest: string; url: string }).digest = "NEXT_REDIRECT";
  (err as unknown as { digest: string; url: string }).url = url;
  throw err;
});

jest.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
}));

jest.mock("@/lib/api/handler", () => ({
  getSessionContextOrNull: jest.fn(),
}));

jest.mock("@/modules/crm-pipeline-automation/service/command-center", () => ({
  getCommandCenterData: jest.fn(),
}));

jest.mock("@/modules/customers/db/tasks", () => ({
  listMyTasks: jest.fn(),
}));

import { getSessionContextOrNull } from "@/lib/api/handler";
import { getCommandCenterData } from "@/modules/crm-pipeline-automation/service/command-center";
import * as tasksDb from "@/modules/customers/db/tasks";
import SalesPage from "../page";
import { render, screen } from "@testing-library/react";

describe("Sales page server component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("redirects to /login when session is null", async () => {
    (getSessionContextOrNull as jest.Mock).mockResolvedValue(null);
    try {
      await SalesPage();
    } catch (e) {
      // redirect throws
    }
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("redirects to /get-started when activeDealershipId is null", async () => {
    (getSessionContextOrNull as jest.Mock).mockResolvedValue({
      userId: "user-1",
      activeDealershipId: null,
      permissions: ["crm.read"],
    });
    try {
      await SalesPage();
    } catch (e) {
      // redirect throws
    }
    expect(mockRedirect).toHaveBeenCalledWith("/get-started");
  });

  it("redirects to /dashboard when user has no sales permission", async () => {
    (getSessionContextOrNull as jest.Mock).mockResolvedValue({
      userId: "user-1",
      activeDealershipId: "dealer-1",
      permissions: ["inventory.read"],
    });
    try {
      await SalesPage();
    } catch (e) {
      // redirect throws
    }
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("calls getCommandCenterData and listMyTasks and renders SalesHubClient when user has crm.read", async () => {
    (getSessionContextOrNull as jest.Mock).mockResolvedValue({
      userId: "user-1",
      activeDealershipId: "dealer-1",
      permissions: ["crm.read"],
    });
    (getCommandCenterData as jest.Mock).mockResolvedValue({
      kpis: { openOpportunities: 5, dueNow: 2, waitingConversations: 1, sequenceExceptions: 0 },
      pressure: { overdueTasks: 1, callbacksDueToday: 0, inboundWaiting: 1, noNextAction: 0, failedJobs: 0 },
      sections: { dueNow: [] },
    });
    (tasksDb.listMyTasks as jest.Mock).mockResolvedValue([
      { id: "t1", title: "Follow up", customerId: "c1", customerName: "Alice", dueAt: null },
    ]);

    const result = await SalesPage();
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(getCommandCenterData).toHaveBeenCalledWith("dealer-1", "user-1", { scope: "mine" });
    expect(tasksDb.listMyTasks).toHaveBeenCalledWith("dealer-1", "user-1", 20);

    render(result);
    expect(screen.getByText("Sales")).toBeInTheDocument();
    expect(screen.getByText("Your pipeline, follow-ups, and inbox at a glance.")).toBeInTheDocument();
  });

  it("allows access with only deals.read and passes empty CRM/task data", async () => {
    (getSessionContextOrNull as jest.Mock).mockResolvedValue({
      userId: "user-1",
      activeDealershipId: "dealer-1",
      permissions: ["deals.read"],
    });

    const result = await SalesPage();
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(getCommandCenterData).not.toHaveBeenCalled();
    expect(tasksDb.listMyTasks).not.toHaveBeenCalled();

    render(result);
    expect(screen.getByText("Sales")).toBeInTheDocument();
    expect(screen.getByText(/No CRM or customer data available/)).toBeInTheDocument();
  });
});
