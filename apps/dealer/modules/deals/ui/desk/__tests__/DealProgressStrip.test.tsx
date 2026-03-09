/**
 * DealProgressStrip: funding/title/delivery progression.
 * Spec: CUSTOMER_DEAL_WORKFLOW_FLOW_REFINEMENT_SPEC.md
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { DealProgressStrip } from "../DealProgressStrip";
import type { DealDetail } from "../../types";
import type { SignalSurfaceItem } from "@/components/ui-system/signals";

const baseDeal: DealDetail = {
  id: "deal-1",
  dealershipId: "d1",
  customerId: "c1",
  vehicleId: "v1",
  salePriceCents: "2500000",
  purchasePriceCents: "2000000",
  taxRateBps: 800,
  taxCents: "200000",
  docFeeCents: "50000",
  downPaymentCents: "500000",
  totalFeesCents: "50000",
  totalDueCents: "2750000",
  frontGrossCents: "500000",
  status: "STRUCTURED",
  notes: null,
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
  deletedAt: null,
  deletedBy: null,
};

const noSignals: SignalSurfaceItem[] = [];

describe("DealProgressStrip", () => {
  it("shows Funding, Title, Delivery labels and links", () => {
    render(
      <DealProgressStrip
        deal={baseDeal}
        dealId="deal-1"
        blockerSignals={noSignals}
      />
    );
    expect(screen.getByRole("region", { name: "Deal progress" })).toBeInTheDocument();
    expect(screen.getByText(/Funding:/)).toBeInTheDocument();
    expect(screen.getByText(/Title:/)).toBeInTheDocument();
    expect(screen.getByText(/Delivery:/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Delivery & Funding" })).toHaveAttribute("href", "/deals/deal-1");
    expect(screen.getByRole("link", { name: "Title queue" })).toHaveAttribute("href", "/queues/title");
  });

  it("shows Pending when no funding/title/delivery and no signals", () => {
    render(
      <DealProgressStrip
        deal={baseDeal}
        dealId="deal-1"
        blockerSignals={noSignals}
      />
    );
    expect(screen.getByText("Funding: Pending")).toBeInTheDocument();
    expect(screen.getByText("Title: Pending")).toBeInTheDocument();
    expect(screen.getByText("Delivery: Pending")).toBeInTheDocument();
  });

  it("shows Done for delivery when deliveryStatus is DELIVERED", () => {
    render(
      <DealProgressStrip
        deal={{ ...baseDeal, deliveryStatus: "DELIVERED", deliveredAt: "2025-01-15T00:00:00Z" }}
        dealId="deal-1"
        blockerSignals={noSignals}
      />
    );
    expect(screen.getByText("Delivery: Done")).toBeInTheDocument();
  });

  it("shows 1 issue when signal code includes funding", () => {
    const signals: SignalSurfaceItem[] = [
      { id: "1", key: "k1", code: "deals.funding_delay", domain: "deals", title: "Funding delay", severity: "warning" },
    ];
    render(
      <DealProgressStrip
        deal={baseDeal}
        dealId="deal-1"
        blockerSignals={signals}
      />
    );
    expect(screen.getByText("Funding: 1 issue")).toBeInTheDocument();
  });
});
