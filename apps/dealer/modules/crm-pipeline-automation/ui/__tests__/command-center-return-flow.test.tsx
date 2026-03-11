import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { CrmCommandCenterPage } from "../CrmCommandCenterPage";

const mockPush = jest.fn();
let mockSearchParams = new URLSearchParams();

jest.mock("@/contexts/session-context", () => ({
  useSession: () => ({
    hasPermission: (key: string) => key === "crm.read" || key === "customers.write",
  }),
}));

jest.mock("@/components/toast", () => ({
  useToast: () => ({ addToast: jest.fn() }),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/crm",
  useSearchParams: () => mockSearchParams,
}));

describe("CrmCommandCenterPage return flow", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    mockPush.mockReset();
    mockFetch.mockReset();
    mockSearchParams = new URLSearchParams("refreshed=1&workedCustomerId=c1");
    ((globalThis as unknown as { fetch: typeof mockFetch }).fetch = mockFetch);

    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            kpis: {
              openOpportunities: 4,
              dueNow: 1,
              staleProspects: 0,
              blockers: 0,
              waitingConversations: 1,
              sequenceExceptions: 0,
            },
            filters: { owners: [], stages: [], sources: [] },
            pressure: {
              overdueTasks: 0,
              callbacksDueToday: 1,
              inboundWaiting: 1,
              noNextAction: 0,
              failedJobs: 0,
            },
            pipeline: {
              stages: [{ stageId: "st1", stageName: "Qualified", count: 4 }],
            },
            sections: {
              dueNow: [
                {
                  id: "task-1",
                  kind: "task",
                  title: "Call Alice",
                  detail: "Alice needs follow-up",
                  customerId: "c1",
                  customerName: "Alice",
                  href: "/customers/profile/c1",
                  nextActionLabel: "Mark done",
                  nextActionHref: "/customers/profile/c1",
                  whenLabel: "5 min ago",
                  severity: "warning",
                },
              ],
              staleProspects: [],
              pipelineBlockers: [],
              sequenceExceptions: [],
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
  });

  it("shows refreshed-state messaging and highlights the worked record", async () => {
    render(<CrmCommandCenterPage />);

    await waitFor(() => {
      expect(screen.getByText(/Queue refreshed/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/last worked record is highlighted below/i)).toBeInTheDocument();
    expect(screen.getByText("Just worked")).toBeInTheDocument();

    const customerLink = screen.getByRole("link", { name: "Call Alice" });
    expect(customerLink).toHaveAttribute("href", "/customers/profile/c1?returnTo=%2Fcrm%3Fscope%3Dall");
  });

  it("preserves the active queue lens in row links", async () => {
    render(
      <CrmCommandCenterPage
        initialQuery={{ scope: "mine", status: "OPEN", source: "Website", q: "alice" }}
      />
    );

    const customerLink = await screen.findByRole("link", { name: "Call Alice" });
    expect(customerLink).toHaveAttribute(
      "href",
      "/customers/profile/c1?returnTo=%2Fcrm%3Fscope%3Dmine%26status%3DOPEN%26source%3DWebsite%26q%3Dalice"
    );
  });
});
