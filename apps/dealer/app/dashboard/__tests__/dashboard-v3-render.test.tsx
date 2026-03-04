/**
 * Dashboard V3: render metric cards + key widgets; QuickActions hrefs; no sensitive data in output.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { DashboardV3Client } from "@/components/dashboard-v3/DashboardV3Client";
import { EMPTY_DASHBOARD_V3_DATA } from "@/components/dashboard-v3/types";

const mockData = {
  ...EMPTY_DASHBOARD_V3_DATA,
  metrics: {
    inventoryCount: 42,
    leadsCount: 10,
    dealsCount: 5,
    bhphCount: 0,
  },
  customerTasks: {
    appointments: 0,
    newProspects: 3,
    inbox: 0,
    followUps: 2,
    creditApps: 1,
  },
  dealPipeline: {
    pendingDeals: 2,
    submittedDeals: 1,
    contractsToReview: 0,
    fundingIssues: 0,
  },
};

describe("DashboardV3Client", () => {
  it("renders metric cards and key widgets when user has permissions", () => {
    const permissions = ["inventory.read", "crm.read", "customers.read", "deals.read", "lenders.read"];
    render(<DashboardV3Client initialData={mockData} permissions={permissions} />);

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
    render(<DashboardV3Client initialData={mockData} permissions={permissions} />);

    const links = screen.getAllByRole("link").filter((a) => a.getAttribute("href")?.startsWith("/"));
    const hrefs = links.map((a) => a.getAttribute("href"));

    expect(hrefs).toContain("/inventory/new");
    expect(hrefs).toContain("/customers/new");
    expect(hrefs).toContain("/deals/new");
  });

  it("does not render email or token-like content in dashboard output", () => {
    const permissions = ["inventory.read", "crm.read", "customers.read", "deals.read"];
    const { container } = render(<DashboardV3Client initialData={mockData} permissions={permissions} />);
    const html = container.innerHTML;

    expect(html).not.toMatch(/Bearer\s+/i);
    expect(html).not.toMatch(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    expect(html).not.toMatch(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  });
});
