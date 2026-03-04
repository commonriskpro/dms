/**
 * Dashboard page: no fetch without permission; single fetch when permitted;
 * widgets rendered only for sections present in response.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import DashboardPage from "../page";

let mockPermissions: string[] = [];
const mockApiFetch = vi.fn();

vi.mock("@/contexts/session-context", () => ({
  useSession: () => ({
    hasPermission: (key: string) => mockPermissions.includes(key),
  }),
}));

vi.mock("@/lib/client/http", () => ({
  apiFetch: (url: string, init?: RequestInit) => mockApiFetch(url, init),
}));

describe("Dashboard page: no fetch without permission", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    mockPermissions = [];
  });

  afterEach(() => {
    cleanup();
  });

  it("does not call GET /api/dashboard when user has neither customers.read nor crm.read", async () => {
    mockPermissions = [];
    render(<DashboardPage />);
    expect(screen.getByText(/You don't have access to the dashboard/i)).toBeInTheDocument();
    await waitFor(() => {});
    expect(mockApiFetch).not.toHaveBeenCalled();
    const dashboardCalls = mockApiFetch.mock.calls.filter(
      (call: [string]) => String(call[0]) === "/api/dashboard"
    );
    expect(dashboardCalls.length).toBe(0);
  });
});

describe("Dashboard page: single fetch and widgets by response", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    mockPermissions = ["customers.read"];
  });

  afterEach(() => {
    cleanup();
  });

  it("calls GET /api/dashboard once when user has customers.read and shows only sections in response", async () => {
    mockApiFetch.mockResolvedValue({
      data: {
        myTasks: [],
        newProspects: [],
        staleLeads: [],
      },
    });
    render(<DashboardPage />);
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledTimes(1);
      expect(mockApiFetch.mock.calls[0][0]).toBe("/api/dashboard");
    });
    expect(screen.getByText("My Tasks")).toBeInTheDocument();
    expect(screen.getByText("New Prospects")).toBeInTheDocument();
    expect(screen.getByText("Stale Leads")).toBeInTheDocument();
    expect(screen.queryByText("Pipeline Funnel")).not.toBeInTheDocument();
    expect(screen.queryByText("Appointments")).not.toBeInTheDocument();
  });

  it("when response has only pipelineFunnel and appointments (crm.read), shows only those widgets", async () => {
    mockPermissions = ["crm.read"];
    mockApiFetch.mockResolvedValue({
      data: {
        pipelineFunnel: { stages: [{ stageId: "s1", stageName: "Lead", count: 5 }] },
        appointments: [],
      },
    });
    render(<DashboardPage />);
    await waitFor(() => {
      expect(mockApiFetch.mock.calls[0][0]).toBe("/api/dashboard");
    });
    expect(screen.getByText("Pipeline Funnel")).toBeInTheDocument();
    expect(screen.getByText("Appointments")).toBeInTheDocument();
    expect(screen.getByText("Lead")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.queryByText("My Tasks")).not.toBeInTheDocument();
    expect(screen.queryByText("New Prospects")).not.toBeInTheDocument();
    expect(screen.queryByText("Stale Leads")).not.toBeInTheDocument();
  });

  it("shows empty states when section is present but array is empty", async () => {
    mockApiFetch.mockResolvedValue({
      data: {
        myTasks: [],
        newProspects: [],
      },
    });
    render(<DashboardPage />);
    await waitFor(() => {
      expect(mockApiFetch.mock.calls[0][0]).toBe("/api/dashboard");
    });
    expect(screen.getByText("No tasks")).toBeInTheDocument();
    expect(screen.getByText("No prospects")).toBeInTheDocument();
  });
});
