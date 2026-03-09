import React from "react";
import { render, screen } from "@testing-library/react";
import { CostTotalsCard } from "../components/CostTotalsCard";

describe("CostTotalsCard", () => {
  it("renders all four cost totals when data is provided", () => {
    render(
      <CostTotalsCard
        cost={{
          vehicleId: "v1",
          auctionCostCents: "2500000",
          transportCostCents: "50000",
          reconCostCents: "120000",
          miscCostCents: "10000",
          totalCostCents: "2680000",
          acquisitionSubtotalCents: "2550000",
          reconSubtotalCents: "120000",
          feesSubtotalCents: "10000",
          totalInvestedCents: "2680000",
        }}
      />
    );
    expect(screen.getByText("Acquisition")).toBeInTheDocument();
    expect(screen.getByText("Recon")).toBeInTheDocument();
    expect(screen.getByText("Fees")).toBeInTheDocument();
    expect(screen.getByText("Total Invested")).toBeInTheDocument();
  });

  it("shows dashes when cost is null", () => {
    render(<CostTotalsCard cost={null} />);
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBe(4);
  });

  it("does not render a 'View breakdown' button", () => {
    render(<CostTotalsCard cost={null} />);
    expect(screen.queryByText("View breakdown")).not.toBeInTheDocument();
  });
});
