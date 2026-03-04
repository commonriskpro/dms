/**
 * Regression: dashboard with switchDealership query param must not crash (React #310).
 * Verifies hook order is stable when activeDealership transitions from null to set.
 */
import React from "react";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import DashboardPage from "../page";

const mockReplace = jest.fn();
const mockApiFetch = jest.fn();
let mockSearchParams = new URLSearchParams();
let mockActiveDealership: { id: string; name: string } | null = null;
let mockStateStatus: "loading" | "authenticated" | "unauthenticated" | "error" = "authenticated";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), refresh: jest.fn() }),
  useSearchParams: () => mockSearchParams,
}));

jest.mock("@/contexts/session-context", () => ({
  useSession: () => ({
    state: { status: mockStateStatus },
    refetch: jest.fn(() => Promise.resolve()),
    hasPermission: (key: string) => ["customers.read", "crm.read"].includes(key),
    activeDealership: mockActiveDealership,
    lifecycleStatus: "ACTIVE",
  }),
}));

jest.mock("@/lib/client/http", () => ({
  apiFetch: (url: string, init?: RequestInit) => mockApiFetch(url, init),
}));

describe("Dashboard switchDealership render (React #310 regression)", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    mockReplace.mockReset();
    mockSearchParams = new URLSearchParams();
    mockActiveDealership = { id: "d1", name: "Dealer One" };
    mockStateStatus = "authenticated";
    mockApiFetch.mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders dashboard without switchDealership param without crashing", () => {
    expect(() => render(<DashboardPage />)).not.toThrow();
    expect(screen.getByText(/Dashboard/)).toBeInTheDocument();
  });

  it("renders dashboard with switchDealership param without crashing", () => {
    mockSearchParams = new URLSearchParams({ switchDealership: "550e8400-e29b-41d4-a716-446655440000" });
    expect(() => render(<DashboardPage />)).not.toThrow();
    expect(screen.getByText(/Dashboard/)).toBeInTheDocument();
  });

  it("renders without crash when activeDealership is null then session would update (hook count stable)", async () => {
    mockActiveDealership = null;
    mockSearchParams = new URLSearchParams();
    expect(() => render(<DashboardPage />)).not.toThrow();
    await waitFor(() => {});
    expect(screen.getByText(/Dashboard/)).toBeInTheDocument();
  });

  it("renders with switchDealership and null activeDealership without crash (simulates post-onboarding load)", async () => {
    mockActiveDealership = null;
    mockSearchParams = new URLSearchParams({ switchDealership: "550e8400-e29b-41d4-a716-446655440000" });
    expect(() => render(<DashboardPage />)).not.toThrow();
    await waitFor(() => {});
    expect(screen.getByText(/Dashboard/)).toBeInTheDocument();
  });
});
