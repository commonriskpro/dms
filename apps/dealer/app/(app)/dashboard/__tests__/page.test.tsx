/**
 * Dashboard V3: client receives initialData only (no fetch on mount).
 * Permission gating: widgets shown only for permitted sections.
 */
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { DashboardV3Client } from "@/components/dashboard-v3/DashboardV3Client";
import { EMPTY_DASHBOARD_V3_DATA } from "@/components/dashboard-v3/types";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: jest.fn(), push: jest.fn(), replace: jest.fn() }),
}));

const mockData = {
  ...EMPTY_DASHBOARD_V3_DATA,
  metrics: {
    inventoryCount: 10,
    inventoryDelta7d: null,
    inventoryDelta30d: null,
    leadsCount: 5,
    leadsDelta7d: null,
    leadsDelta30d: null,
    dealsCount: 3,
    dealsDelta7d: null,
    dealsDelta30d: null,
    bhphCount: 0,
    bhphDelta7d: null,
    bhphDelta30d: null,
  },
  customerTasks: [
    { key: "appointments", label: "Appointments", count: 0 },
    { key: "newProspects", label: "New Prospects", count: 2 },
    { key: "inbox", label: "Inbox", count: 0 },
    { key: "followUps", label: "Follow-ups", count: 1 },
    { key: "creditApps", label: "Credit Apps", count: 0 },
  ],
  inventoryAlerts: [
    { key: "carsInRecon", label: "Cars in recon", count: 0 },
    { key: "pendingTasks", label: "Pending tasks", count: 0 },
  ],
  dealPipeline: [
    { key: "pendingDeals", label: "Pending deals", count: 1 },
    { key: "submittedDeals", label: "Submitted", count: 0 },
    { key: "contractsToReview", label: "Contracts to review", count: 0 },
    { key: "fundingIssues", label: "Funding issues", count: 0 },
  ],
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
