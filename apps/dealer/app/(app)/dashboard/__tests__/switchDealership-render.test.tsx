/**
 * Regression: dashboard with switchDealership query param must not crash (React #310).
 * Tests client tree: DashboardSwitchWrapper + DashboardExecutiveClient (hook order stable).
 */
import React from "react";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/toast-provider";
import { DashboardSwitchWrapper } from "@/components/dashboard-v3/DashboardSwitchWrapper";
import { DashboardExecutiveClient } from "@/components/dashboard-v3/DashboardExecutiveClient";
import { EMPTY_DASHBOARD_V3_DATA } from "@/components/dashboard-v3/types";

const mockReplace = jest.fn();
const mockApiFetch = jest.fn();
let mockSearchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), refresh: jest.fn() }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => "/dashboard",
}));

jest.mock("@/contexts/session-context", () => ({
  useSession: () => ({
    state: { status: "authenticated" as const },
    refetch: jest.fn(() => Promise.resolve()),
    hasPermission: (key: string) => ["customers.read", "crm.read"].includes(key),
    activeDealership: { id: "d1", name: "Dealer One" },
    lifecycleStatus: "ACTIVE",
  }),
}));

jest.mock("@/lib/client/http", () => ({
  apiFetch: (url: string, init?: RequestInit) => mockApiFetch(url, init),
}));

const initialData = {
  ...EMPTY_DASHBOARD_V3_DATA,
  metrics: {
    inventoryCount: 1,
    inventoryDelta7d: null,
    inventoryDelta30d: null,
    inventoryTrend: [],
    leadsCount: 0,
    leadsDelta7d: null,
    leadsDelta30d: null,
    leadsTrend: [],
    dealsCount: 0,
    dealsDelta7d: null,
    dealsDelta30d: null,
    dealsTrend: [],
    bhphCount: 0,
    bhphDelta7d: null,
    bhphDelta30d: null,
    bhphTrend: [],
    opsTrend: [],
  },
};
const permissions = ["customers.read", "crm.read"];

describe("Dashboard switchDealership render (React #310 regression)", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    mockReplace.mockReset();
    mockSearchParams = new URLSearchParams();
    mockApiFetch.mockResolvedValue({});
  });

  afterEach(() => {
    cleanup();
  });

  it("renders dashboard without switchDealership param without crashing", () => {
    expect(() =>
      render(
        <ToastProvider>
          <DashboardSwitchWrapper>
            <DashboardExecutiveClient initialData={initialData} permissions={permissions} />
          </DashboardSwitchWrapper>
        </ToastProvider>
      )
    ).not.toThrow();
    expect(screen.getByText(/New Leads/)).toBeInTheDocument();
  });

  it("renders dashboard with switchDealership param without crashing", () => {
    mockSearchParams = new URLSearchParams({ switchDealership: "550e8400-e29b-41d4-a716-446655440000" });
    expect(() =>
      render(
        <ToastProvider>
          <DashboardSwitchWrapper>
            <DashboardExecutiveClient initialData={initialData} permissions={permissions} />
          </DashboardSwitchWrapper>
        </ToastProvider>
      )
    ).not.toThrow();
    expect(screen.getByText(/New Leads/)).toBeInTheDocument();
  });

  it("renders without crash when wrapper and client are mounted (hook count stable)", async () => {
    expect(() =>
      render(
        <ToastProvider>
          <DashboardSwitchWrapper>
            <DashboardExecutiveClient initialData={initialData} permissions={permissions} />
          </DashboardSwitchWrapper>
        </ToastProvider>
      )
    ).not.toThrow();
    await waitFor(() => {});
    expect(screen.getByText(/New Leads/)).toBeInTheDocument();
  });
});
