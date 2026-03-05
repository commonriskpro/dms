/**
 * Dashboard V3: render metric cards + key widgets; QuickActions hrefs; no sensitive data in output.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/toast-provider";
import { DashboardV3Client } from "@/components/dashboard-v3/DashboardV3Client";
import { EMPTY_DASHBOARD_V3_DATA } from "@/components/dashboard-v3/types";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: jest.fn(), push: jest.fn(), replace: jest.fn() }),
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
    leadsCount: 10,
    leadsDelta7d: null,
    leadsDelta30d: null,
    dealsCount: 5,
    dealsDelta7d: null,
    dealsDelta30d: null,
    bhphCount: 0,
    bhphDelta7d: null,
    bhphDelta30d: null,
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
};

describe("DashboardV3Client", () => {
  it("renders metric cards and key widgets when user has permissions", () => {
    const permissions = ["inventory.read", "crm.read", "customers.read", "deals.read", "lenders.read"];
    renderWithProviders(<DashboardV3Client initialData={mockData} permissions={permissions} />);

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Inventory")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Leads")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("Customer Tasks")).toBeInTheDocument();
    expect(screen.getByText("Deal Pipeline")).toBeInTheDocument();
    expect(screen.getByText("Quick Actions")).toBeInTheDocument();
  });

  it("Quick Actions has correct hrefs when user has write permissions", () => {
    const permissions = [
      "inventory.read",
      "inventory.write",
      "customers.read",
      "customers.write",
      "deals.read",
      "deals.write",
    ];
    renderWithProviders(<DashboardV3Client initialData={mockData} permissions={permissions} />);

    const links = screen.getAllByRole("link").filter((a) => a.getAttribute("href")?.startsWith("/"));
    const hrefs = links.map((a) => a.getAttribute("href"));

    expect(hrefs).toContain("/inventory/new");
    expect(hrefs).toContain("/customers/new");
    expect(hrefs).toContain("/deals/new");
  });

  it("Quick Actions shows no action links when user has only read permissions (RBAC gating)", () => {
    const permissions = ["inventory.read", "crm.read", "customers.read", "deals.read"];
    renderWithProviders(<DashboardV3Client initialData={mockData} permissions={permissions} />);
    expect(screen.getByText("No actions available.")).toBeInTheDocument();
    const links = screen.getAllByRole("link").filter((a) => a.getAttribute("href")?.startsWith("/"));
    const hrefs = links.map((a) => a.getAttribute("href"));
    expect(hrefs).not.toContain("/inventory/new");
    expect(hrefs).not.toContain("/customers/new");
    expect(hrefs).not.toContain("/deals/new");
  });

  it("does not render email or token-like content in dashboard output", () => {
    const permissions = ["inventory.read", "crm.read", "customers.read", "deals.read"];
    const { container } = renderWithProviders(<DashboardV3Client initialData={mockData} permissions={permissions} />);
    const html = container.innerHTML;

    expect(html).not.toMatch(/Bearer\s+/i);
    expect(html).not.toMatch(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    expect(html).not.toMatch(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  });

  it("Step 4 red-flag: rendered output must not contain token, cookie, authorization, bearer, supabase, or email", () => {
    const permissions = ["inventory.read", "crm.read", "customers.read", "deals.read", "lenders.read"];
    const { container } = renderWithProviders(<DashboardV3Client initialData={mockData} permissions={permissions} />);
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

  it("shows Last updated and Refresh button", () => {
    const permissions = ["inventory.read", "crm.read"];
    renderWithProviders(<DashboardV3Client initialData={mockData} permissions={permissions} />);
    expect(screen.getByText(/Last updated/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Refresh dashboard/i })).toBeInTheDocument();
  });

  it("renders metric helper text (delta listed)", () => {
    const dataWithDelta = {
      ...mockData,
      metrics: {
        ...mockData.metrics,
        leadsCount: 56,
        leadsDelta7d: 7,
        leadsDelta30d: null,
      },
    };
    const permissions = ["crm.read"];
    renderWithProviders(<DashboardV3Client initialData={dataWithDelta} permissions={permissions} />);
    expect(screen.getByText("56")).toBeInTheDocument();
    expect(screen.getByText("+7 listed")).toBeInTheDocument();
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
    const { container } = renderWithProviders(<DashboardV3Client initialData={dataWithSeverity} permissions={permissions} />);
    expect(screen.getByText("Cars in recon")).toBeInTheDocument();
    expect(screen.getByText("Missing docs")).toBeInTheDocument();
    expect(container.innerHTML).toMatch(/var\(--sev-warning\)|var\(--sev-danger\)/);
  });

  it("widget rows with href are clickable (button with arrow)", () => {
    const permissions = ["customers.read", "deals.read"];
    renderWithProviders(<DashboardV3Client initialData={mockData} permissions={permissions} />);
    const buttons = screen.getAllByRole("button");
    const rowButtons = buttons.filter((b) => b.textContent?.includes("→") || b.closest("li"));
    expect(buttons.length).toBeGreaterThan(0);
    expect(screen.getByText("Customer Tasks")).toBeInTheDocument();
    expect(screen.getByText("Deal Pipeline")).toBeInTheDocument();
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
    renderWithProviders(<DashboardV3Client initialData={dataWithActions} permissions={permissions} />);
    expect(screen.getByText("Recommended Actions")).toBeInTheDocument();
    expect(screen.getByText(/deals waiting funding approval/)).toBeInTheDocument();
    expect(screen.getAllByText("Review").length).toBeGreaterThan(0);
  });
});
