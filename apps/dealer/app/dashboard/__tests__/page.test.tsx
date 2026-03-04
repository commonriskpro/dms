/**
 * Dashboard V3: client receives initialData only (no fetch on mount).
 * Permission gating: widgets shown only for permitted sections.
 */
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { DashboardV3Client } from "@/components/dashboard-v3/DashboardV3Client";
import { EMPTY_DASHBOARD_V3_DATA } from "@/components/dashboard-v3/types";

const mockData = {
  ...EMPTY_DASHBOARD_V3_DATA,
  metrics: { inventoryCount: 10, leadsCount: 5, dealsCount: 3, bhphCount: 0 },
  customerTasks: { appointments: 0, newProspects: 2, inbox: 0, followUps: 1, creditApps: 0 },
  dealPipeline: { pendingDeals: 1, submittedDeals: 0, contractsToReview: 0, fundingIssues: 0 },
};

describe("Dashboard V3: no fetch on mount", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders access message when user has neither customers.read nor crm.read (server handles; client shows minimal)", () => {
    render(<DashboardV3Client initialData={mockData} permissions={[]} />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Inventory")).not.toBeInTheDocument();
    expect(screen.queryByText("Leads")).not.toBeInTheDocument();
    expect(screen.queryByText("Customer Tasks")).not.toBeInTheDocument();
  });

  it("shows Customer Tasks and Deal Pipeline when user has customers.read and deals.read", () => {
    render(
      <DashboardV3Client
        initialData={mockData}
        permissions={["customers.read", "deals.read"]}
      />
    );
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Customer Tasks")).toBeInTheDocument();
    expect(screen.getByText("Deal Pipeline")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows Inventory Alerts only when user has inventory.read", () => {
    render(
      <DashboardV3Client
        initialData={mockData}
        permissions={["inventory.read"]}
      />
    );
    expect(screen.getByText("Inventory Alerts")).toBeInTheDocument();
    expect(screen.getByText("Inventory")).toBeInTheDocument();
  });
});
