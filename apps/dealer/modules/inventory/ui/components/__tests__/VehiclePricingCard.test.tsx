/**
 * Inventory Profitability V1 — VehiclePricingCard: Total invested and Projected gross (ledger-derived).
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { VehiclePricingCard } from "../VehiclePricingCard";
import type { VehicleDetailResponse } from "../../types";

function renderCard(vehicle: VehicleDetailResponse) {
  return render(<VehiclePricingCard vehicle={vehicle} />);
}

describe("VehiclePricingCard", () => {
  it("renders Pricing title", () => {
    renderCard({
      id: "v1",
      dealershipId: "d1",
      stockNumber: "STK1",
      status: "AVAILABLE",
      locationId: null,
      createdAt: "",
      updatedAt: "",
    } as VehicleDetailResponse);
    expect(screen.getByText("Pricing")).toBeInTheDocument();
  });

  it("shows Sale Price, Total Invested, Floor Plan, Projected Gross labels", () => {
    renderCard({
      id: "v1",
      dealershipId: "d1",
      stockNumber: "STK1",
      status: "AVAILABLE",
      salePriceCents: "2000000",
      totalInvestedCents: "1650000",
      projectedGrossCents: "350000",
      locationId: null,
      createdAt: "",
      updatedAt: "",
    } as VehicleDetailResponse);
    expect(screen.getByText("Sale Price")).toBeInTheDocument();
    expect(screen.getByText("Total Invested")).toBeInTheDocument();
    expect(screen.getByText("Floor Plan")).toBeInTheDocument();
    expect(screen.getByText("Projected Gross")).toBeInTheDocument();
  });

  it("displays formatted total invested and projected gross from API fields", () => {
    renderCard({
      id: "v1",
      dealershipId: "d1",
      stockNumber: "STK1",
      status: "AVAILABLE",
      salePriceCents: "2000000",
      totalInvestedCents: "1650000",
      projectedGrossCents: "350000",
      locationId: null,
      createdAt: "",
      updatedAt: "",
    } as VehicleDetailResponse);
    expect(screen.getByText("$20,000.00")).toBeInTheDocument();
    expect(screen.getByText("$16,500.00")).toBeInTheDocument();
    expect(screen.getByText("$3,500.00")).toBeInTheDocument();
  });

  it("shows — when total invested or projected gross missing", () => {
    renderCard({
      id: "v1",
      dealershipId: "d1",
      stockNumber: "STK1",
      status: "AVAILABLE",
      locationId: null,
      createdAt: "",
      updatedAt: "",
    } as VehicleDetailResponse);
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });
});
