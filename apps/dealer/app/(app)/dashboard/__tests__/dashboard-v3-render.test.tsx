/**
 * Dashboard executive client: render key widgets and verify no sensitive data in output.
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/toast-provider";
import { DashboardExecutiveClient } from "@/components/dashboard-v3/DashboardExecutiveClient";
import { EMPTY_DASHBOARD_V3_DATA } from "@/components/dashboard-v3/types";

const mockSearchParams = new URLSearchParams();
const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: jest.fn(), push: jest.fn(), replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => "/dashboard",
}));

function renderWithProviders(ui: React.ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

const mockData = {
  ...EMPTY_DASHBOARD_V3_DATA,
  metrics: {
    inventoryCount: 42,
    inventoryDelta7d: null,
    inventoryDelta30d: null,
    inventoryTrend: [],
    leadsCount: 10,
    leadsDelta7d: null,
    leadsDelta30d: null,
    leadsTrend: [],
    dealsCount: 5,
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
    { key: "newProspects", label: "New Prospects", count: 3 },
    { key: "inbox", label: "Inbox", count: 0 },
    { key: "followUps", label: "Follow-ups", count: 2 },
    { key: "creditApps", label: "Credit Apps", count: 1 },
  ],
  inventoryAlerts: [
    { key: "carsInRecon", label: "Cars in recon", count: 0 },
    { key: "pendingTasks", label: "Pending tasks", count: 0 },
  ],
  dealPipeline: [
    { key: "pendingDeals", label: "Pending deals", count: 2 },
    { key: "submittedDeals", label: "Submitted", count: 1 },
    { key: "contractsToReview", label: "Contracts to review", count: 0 },
    { key: "fundingIssues", label: "Funding issues", count: 0 },
  ],
  salesManager: {
    topCloserName: "Alex Closer",
    topCloserDealsClosed: 4,
    topGrossRepName: "Morgan Gross",
    topGrossRepCents: 710000,
    averageGrossPerDealCents: 225000,
    rankedRepCount: 2,
    staleLeadCount: 3,
    oldestStaleLeadAgeDays: 9,
    overdueFollowUpCount: 2,
    appointmentsSetToday: 4,
    callbacksScheduledToday: 2,
    rangeLabel: "Last 30 days",
  },
};

describe("DashboardExecutiveClient", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockReplace.mockReset();
    mockSearchParams.delete("preset");
  });

  it("renders metric cards and key widgets when user has permissions", () => {
    const permissions = ["inventory.read", "crm.read", "customers.read", "deals.read", "lenders.read"];
    renderWithProviders(<DashboardExecutiveClient initialData={mockData} permissions={permissions} />);

    expect(screen.getAllByText("Inventory").length).toBeGreaterThan(0);
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("New Leads")).toBeInTheDocument();
    expect(screen.getAllByText("10").length).toBeGreaterThan(0);
    expect(screen.getByText("Revenue and pipeline")).toBeInTheDocument();
    expect(screen.getByText("Customer demand")).toBeInTheDocument();
    expect(screen.getByText("Acquisition")).toBeInTheDocument();
    expect(screen.queryByText("Inventory command view")).not.toBeInTheDocument();
  });

  it("workbench is shown (not placeholder) when user has write permissions", () => {
    const permissions = [
      "inventory.read",
      "inventory.write",
      "customers.read",
      "customers.write",
      "deals.read",
      "deals.write",
    ];
    renderWithProviders(<DashboardExecutiveClient initialData={mockData} permissions={permissions} />);
    expect(screen.queryByText("Inventory command view")).not.toBeInTheDocument();
    expect(screen.getAllByText("Inventory").length).toBeGreaterThan(0);
  });

  it("Quick Actions shows no action links when user has only read permissions (RBAC gating)", () => {
    const permissions = ["inventory.read", "crm.read", "customers.read", "deals.read"];
    renderWithProviders(<DashboardExecutiveClient initialData={mockData} permissions={permissions} />);
    expect(screen.getAllByText("Inventory").length).toBeGreaterThan(0);
    const links = screen.getAllByRole("link").filter((a) => a.getAttribute("href")?.startsWith("/"));
    const hrefs = links.map((a) => a.getAttribute("href"));
    expect(hrefs).not.toContain("/inventory/new");
    expect(hrefs).not.toContain("/customers/new");
    expect(hrefs).not.toContain("/deals/new");
  });

  it("hides inventory workbench data when inventory.read is missing", () => {
    const permissions = ["crm.read", "customers.read", "deals.read"];
    renderWithProviders(<DashboardExecutiveClient initialData={mockData} permissions={permissions} />);
    expect(screen.queryByText("Cars in recon")).not.toBeInTheDocument();
    expect(screen.queryByText("Acquisition")).not.toBeInTheDocument();
  });

  it("hides acquisition panel when acquisition permission is missing", () => {
    const permissions = ["crm.read", "customers.read", "deals.read"];
    renderWithProviders(<DashboardExecutiveClient initialData={mockData} permissions={permissions} />);
    expect(screen.queryByText("Acquisition")).not.toBeInTheDocument();
  });

  it("does not render email or token-like content in dashboard output", () => {
    const permissions = ["inventory.read", "crm.read", "customers.read", "deals.read"];
    const { container } = renderWithProviders(<DashboardExecutiveClient initialData={mockData} permissions={permissions} />);
    const html = container.innerHTML;

    expect(html).not.toMatch(/Bearer\s+/i);
    expect(html).not.toMatch(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    expect(html).not.toMatch(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  });

  it("Step 4 red-flag: rendered output must not contain token, cookie, authorization, bearer, supabase, or email", () => {
    const permissions = ["inventory.read", "crm.read", "customers.read", "deals.read", "lenders.read"];
    const { container } = renderWithProviders(<DashboardExecutiveClient initialData={mockData} permissions={permissions} />);
    const html = container.innerHTML;
    const lower = html.toLowerCase();

    expect(lower).not.toMatch(/authorization/i);
    expect(lower).not.toMatch(/bearer\s+/);
    expect(lower).not.toMatch(/supabase/);
    expect(html).not.toMatch(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (lower.includes("token")) {
      expect(lower).not.toMatch(/\b(access_?token|refresh_?token|id_?token|auth_?token)\b/);
    }
    if (lower.includes("cookie")) {
      expect(lower).not.toMatch(/\bcookies?\s*[:=]/);
    }
  });

  it("applies severity to widget rows (warning/danger) using semantic tokens", () => {
    const dataWithSeverity = {
      ...mockData,
      inventoryAlerts: [
        { key: "carsInRecon", label: "Cars in recon", count: 3, severity: "warning" as const },
        { key: "missingDocs", label: "Missing docs", count: 1, severity: "danger" as const },
      ],
    };
    const permissions = ["inventory.read"];
    const { container } = renderWithProviders(<DashboardExecutiveClient initialData={dataWithSeverity} permissions={permissions} />);
    expect(screen.getAllByText("Cars in recon").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Missing docs").length).toBeGreaterThan(0);
    expect(container.innerHTML).toMatch(/var\(--warning\)|var\(--danger\)|var\(--warning-muted\)|var\(--danger-muted\)/);
  });

  it("widget rows with href are clickable links", () => {
    const permissions = ["customers.read", "deals.read"];
    renderWithProviders(<DashboardExecutiveClient initialData={mockData} permissions={permissions} />);
    const links = screen
      .getAllByRole("link")
      .filter((a) => a.getAttribute("href")?.startsWith("/"));
    expect(links.length).toBeGreaterThan(0);
    expect(screen.getByText("Revenue and pipeline")).toBeInTheDocument();
    expect(screen.getAllByText("Activity and accountability").length).toBeGreaterThan(0);
  });

  it("renders Recommended Actions when rules match (funding or credit)", () => {
    const dataWithActions = {
      ...mockData,
      dealPipeline: [
        { key: "pendingDeals", label: "Pending deals", count: 0 },
        { key: "submittedDeals", label: "Submitted", count: 0 },
        { key: "contractsToReview", label: "Contracts to review", count: 0 },
        { key: "fundingIssues", label: "Funding issues", count: 3 },
      ],
    };
    const permissions = ["inventory.read", "crm.read", "customers.read", "deals.read", "lenders.read"];
    renderWithProviders(<DashboardExecutiveClient initialData={dataWithActions} permissions={permissions} />);
    expect(screen.getAllByText("Activity and accountability").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Funding issues").length).toBeGreaterThan(0);
  });

  it("health score remains visible while domain contributions are permission-scoped", () => {
    const data = {
      ...mockData,
      inventoryAlerts: [{ key: "carsInRecon", label: "Cars in recon", count: 2, severity: "danger" as const }],
      dealPipeline: [{ key: "fundingIssues", label: "Funding issues", count: 3, severity: "danger" as const }],
      financeNotices: [{ id: "n1", title: "Ops", severity: "warning" as const }],
    };
    const permissions = ["deals.read"];
    renderWithProviders(<DashboardExecutiveClient initialData={data} permissions={permissions} />);
    expect(screen.getByText("Ops Score")).toBeInTheDocument();
    expect(screen.getAllByText(/unresolved/i).length).toBeGreaterThan(0);
  });

  it("renders material changes with actor attribution when present", () => {
    const dataWithChanges = {
      ...mockData,
      materialChanges: [
        {
          id: "change-1",
          domain: "deals" as const,
          title: "Deal moved to Contracted",
          detail: "Sam Buyer · 2025 Kia Soul · Draft → Contracted",
          severity: "success" as const,
          actorLabel: "Desk Manager",
          timestamp: "2026-03-10T18:00:00.000Z",
          href: "/deals/deal-1",
        },
      ],
    };
    renderWithProviders(
      <DashboardExecutiveClient
        initialData={dataWithChanges}
        permissions={["inventory.read", "crm.read", "customers.read", "deals.read"]}
      />
    );
    expect(screen.getByText("Recent material changes")).toBeInTheDocument();
    expect(screen.getByText("Deal moved to Contracted")).toBeInTheDocument();
    expect(screen.getByText("By Desk Manager")).toBeInTheDocument();
  });

  it("restores saved preset when URL does not explicitly provide one", async () => {
    window.localStorage.setItem("dealer-dashboard-executive-preset:v1:dealer-1:user-1", "sales");
    renderWithProviders(
      <DashboardExecutiveClient
        initialData={mockData}
        permissions={["inventory.read", "crm.read", "customers.read", "deals.read"]}
        userId="user-1"
        activeDealershipId="dealer-1"
      />
    );
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/dashboard?preset=sales", { scroll: false });
    });
  });

  it("persists selected preset per user and dealership when switching views", () => {
    renderWithProviders(
      <DashboardExecutiveClient
        initialData={mockData}
        permissions={["inventory.read", "crm.read", "customers.read", "deals.read"]}
        userId="user-1"
        activeDealershipId="dealer-1"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Sales" }));
    expect(window.localStorage.getItem("dealer-dashboard-executive-preset:v1:dealer-1:user-1")).toBe("sales");
    expect(mockReplace).toHaveBeenCalledWith("/dashboard?preset=sales", { scroll: false });
  });

  it("renders real sales coaching metrics in the Sales preset", () => {
    mockSearchParams.set("preset", "sales");
    renderWithProviders(
      <DashboardExecutiveClient
        initialData={mockData}
        permissions={["inventory.read", "crm.read", "customers.read", "deals.read"]}
        userId="user-1"
        activeDealershipId="dealer-1"
      />
    );
    expect(screen.getByText("Sales command board")).toBeInTheDocument();
    expect(screen.getByText("Stale leads")).toBeInTheDocument();
    expect(screen.getByText("Overdue follow-ups")).toBeInTheDocument();
    expect(screen.getByText("Appointments set today")).toBeInTheDocument();
    expect(screen.getByText("Top closer")).toBeInTheDocument();
    expect(screen.getByText("Top gross rep")).toBeInTheDocument();
  });
});
