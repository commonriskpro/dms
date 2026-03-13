/**
 * DealProgressStrip: mode-aware desk/payment-or-finance/delivery/title progression.
 * Spec: DEAL_SALES_FLOW_UI_REWRITE_SPEC.md
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
  it("shows finance workflow labels and deep links", () => {
    render(
      <DealProgressStrip
        deal={baseDeal}
        dealId="deal-1"
        blockerSignals={noSignals}
      />
    );
    expect(screen.getByRole("region", { name: "Deal progress" })).toBeInTheDocument();
    expect(screen.getByText(/Desk:/)).toBeInTheDocument();
    expect(screen.getByText(/Finance:/)).toBeInTheDocument();
    expect(screen.getByText(/Funding:/)).toBeInTheDocument();
    expect(screen.getByText(/Title:/)).toBeInTheDocument();
    expect(screen.getByText(/Delivery:/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Delivery & funding" })).toHaveAttribute("href", "/deals/deal-1?focus=delivery-funding");
    expect(screen.getByRole("link", { name: "Title & DMV" })).toHaveAttribute("href", "/deals/deal-1?focus=title-dmv");
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

  it("switches to cash workflow when the deal mode is cash", () => {
    render(
      <DealProgressStrip
        deal={{
          ...baseDeal,
          dealFinance: {
            id: "finance-1",
            dealId: "deal-1",
            financingMode: "CASH",
            termMonths: null,
            aprBps: null,
            cashDownCents: "500000",
            amountFinancedCents: "0",
            monthlyPaymentCents: "0",
            totalOfPaymentsCents: "0",
            financeChargeCents: "0",
            productsTotalCents: "0",
            backendGrossCents: "0",
            reserveCents: null,
            status: "DRAFT",
            firstPaymentDate: null,
            lenderName: null,
            notes: null,
            createdAt: "2025-01-01T00:00:00Z",
            updatedAt: "2025-01-01T00:00:00Z",
            products: [],
          },
        }}
        dealId="deal-1"
        blockerSignals={noSignals}
      />
    );
    expect(screen.getByText(/Payment:/)).toBeInTheDocument();
    expect(screen.queryByText(/Funding:/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Delivery" })).toHaveAttribute("href", "/deals/deal-1?focus=delivery-funding");
  });
});
