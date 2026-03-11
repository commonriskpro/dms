/**
 * Snapshot tests for dashboard executive components.
 * Asserts that rendered output uses token-based class names (no drift to ad-hoc colors).
 */
import React from "react";
import { render } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/toast-provider";
import { MetricCard } from "../MetricCard";
import { WidgetCard } from "../WidgetCard";
import { DashboardExecutiveClient } from "../DashboardExecutiveClient";
import { EMPTY_DASHBOARD_V3_DATA } from "../types";

const mockSearchParams = new URLSearchParams();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => "/dashboard",
}));

jest.mock("next/link", () => {
  return function MockLink({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) {
    return <a href={href} className={className}>{children}</a>;
  };
});

const mockData = {
  ...EMPTY_DASHBOARD_V3_DATA,
  dashboardGeneratedAt: "2026-03-04T12:00:00.000Z",
  metrics: {
    inventoryCount: 42,
    inventoryDelta7d: 7,
    inventoryDelta30d: null,
    inventoryTrend: [30, 35, 28, 42, 38, 45, 42],
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
    { key: "newProspects", label: "New Prospects", count: 3 },
    { key: "followUps", label: "Follow-ups", count: 2 },
  ],
  inventoryAlerts: [
    { key: "carsInRecon", label: "Cars in recon", count: 1, severity: "warning" as const },
  ],
  dealPipeline: [
    { key: "pendingDeals", label: "Pending deals", count: 2 },
    { key: "fundingIssues", label: "Funding issues", count: 0, severity: "danger" as const },
  ],
  financeNotices: [],
  appointments: [],
  floorplan: [],
};

describe("Dashboard executive snapshots (token consistency)", () => {
  it("MetricCard matches snapshot (uses token classes)", () => {
    const { container } = render(
      <MetricCard
        title="Inventory"
        value={182}
        delta7d={12}
        delta30d={28}
        href="/inventory"
      />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("WidgetCard with rows matches snapshot (uses token classes)", () => {
    const { container } = render(
      <WidgetCard title="Customer Tasks">
        <ul>
          <li>Row one</li>
          <li>Row two</li>
        </ul>
      </WidgetCard>
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it("DashboardExecutiveClient happy state matches snapshot (token-based layout)", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-04T20:00:00.000Z"));
    const permissions = ["inventory.read", "crm.read", "customers.read", "deals.read", "lenders.read"];
    const { container } = render(
      <ToastProvider>
        <DashboardExecutiveClient initialData={mockData} permissions={permissions} />
      </ToastProvider>
    );
    expect(container).toMatchSnapshot();
    jest.useRealTimers();
  });
});
