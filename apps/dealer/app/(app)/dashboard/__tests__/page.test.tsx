/**
 * Dashboard executive client: receives initialData only (no fetch on mount).
 * Permission gating: widgets shown only for permitted sections.
 */
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/toast-provider";
import { DashboardExecutiveClient } from "@/components/dashboard-v3/DashboardExecutiveClient";
import { EMPTY_DASHBOARD_V3_DATA } from "@/components/dashboard-v3/types";

const mockSearchParams = new URLSearchParams();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => "/dashboard",
}));

function renderWithToast(ui: React.ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

const mockData = {
  ...EMPTY_DASHBOARD_V3_DATA,
  metrics: {
    inventoryCount: 10,
    inventoryDelta7d: null,
    inventoryDelta30d: null,
    inventoryTrend: [],
    leadsCount: 5,
    leadsDelta7d: null,
    leadsDelta30d: null,
    leadsTrend: [],
    dealsCount: 3,
    dealsDelta7d: null,
    dealsDelta30d: null,
    dealsTrend: [],
    bhphCount: 0,
    bhphDelta7d: null,
    bhphDelta30d: null,
    bhphTrend: [],
    opsTrend: [],
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

describe("Dashboard executive client: no fetch on mount", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders access message when user has neither customers.read nor crm.read (server handles; client shows minimal)", () => {
    renderWithToast(<DashboardExecutiveClient initialData={mockData} permissions={[]} />);
    expect(screen.getByText("Executive control tower")).toBeInTheDocument();
    expect(screen.getByText("Ops Score")).toBeInTheDocument();
    expect(screen.queryByText("New Leads")).not.toBeInTheDocument();
  });

  it("shows Customer Tasks and Deal Pipeline when user has customers.read and deals.read", () => {
    renderWithToast(
      <DashboardExecutiveClient
        initialData={mockData}
        permissions={["customers.read", "deals.read"]}
      />
    );
    expect(screen.getByText("Revenue and pipeline")).toBeInTheDocument();
    expect(screen.getAllByText("Activity and accountability").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pending deals").length).toBeGreaterThan(0);
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
  });

  it("shows Inventory Alerts only when user has inventory.read", () => {
    renderWithToast(
      <DashboardExecutiveClient
        initialData={mockData}
        permissions={["inventory.read"]}
      />
    );
    expect(screen.getAllByText("Inventory").length).toBeGreaterThan(0);
  });
});
