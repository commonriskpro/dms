/**
 * Smoke test: Last updated text and Refresh button.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { InventoryDashboardHeader } from "../InventoryDashboardHeader";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: jest.fn(), push: jest.fn(), replace: jest.fn() }),
}));

describe("InventoryDashboardHeader", () => {
  it("renders Last updated text and Refresh button", () => {
    const lastUpdatedMs = new Date("2025-01-15T14:30:00").getTime();
    render(<InventoryDashboardHeader lastUpdatedMs={lastUpdatedMs} />);
    expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
    const refresh = screen.getByRole("button", { name: /Refresh dashboard/i });
    expect(refresh).toBeInTheDocument();
  });
});
