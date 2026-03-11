/**
 * ActiveOpportunityDealCard: one primary active deal or opportunity.
 * Spec: CUSTOMER_DEAL_WORKFLOW_FLOW_REFINEMENT_SPEC.md
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { ActiveOpportunityDealCard } from "../ActiveOpportunityDealCard";
import { apiFetch } from "@/lib/client/http";

jest.mock("@/lib/client/http", () => ({
  apiFetch: jest.fn(),
}));

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

describe("ActiveOpportunityDealCard", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  it("renders nothing when neither canReadDeals nor canReadCrm", () => {
    const { container } = render(
      <ActiveOpportunityDealCard
        customerId="c1"
        canReadDeals={false}
        canReadCrm={false}
      />
    );
    expect(container.firstChild).toBeNull();
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("shows loading then No active deal or opportunity when APIs return empty", async () => {
    mockApiFetch
      .mockResolvedValueOnce({ data: [], meta: { total: 0 } })
      .mockResolvedValueOnce({ data: [], meta: { total: 0 } });

    render(
      <ActiveOpportunityDealCard
        customerId="c1"
        canReadDeals={true}
        canReadCrm={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Active deal or opportunity")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText("No active deal or opportunity.")).toBeInTheDocument();
    });
    expect(mockApiFetch).toHaveBeenCalledTimes(2);
  });

  it("shows active deal link when deals API returns one non-CANCELED deal", async () => {
    mockApiFetch.mockResolvedValueOnce({
      data: [
        {
          id: "deal-1",
          customerId: "c1",
          vehicleId: "v1",
          status: "STRUCTURED",
          salePriceCents: "2500000",
          frontGrossCents: "50000",
          totalDueCents: "2600000",
          createdAt: "2025-01-01T00:00:00Z",
          vehicle: { id: "v1", stockNumber: "S123", vin: null, year: 2024, make: "Honda", model: "Civic" },
        },
      ],
      meta: { total: 1 },
    });
    mockApiFetch.mockResolvedValueOnce({ data: [], meta: { total: 0 } });

    render(
      <ActiveOpportunityDealCard
        customerId="c1"
        canReadDeals={true}
        canReadCrm={true}
      />
    );

    await waitFor(() => {
      const link = screen.getByRole("link", { name: /Active deal — Stock #S123/i });
      expect(link).toHaveAttribute("href", "/deals/deal-1");
    });
  });

  it("shows active opportunity when opportunities API returns OPEN and no deal", async () => {
    mockApiFetch.mockResolvedValueOnce({ data: [], meta: { total: 0 } });
    mockApiFetch.mockResolvedValueOnce({
      data: [
        {
          id: "opp-1",
          dealershipId: "d1",
          customerId: "c1",
          vehicleId: null,
          dealId: null,
          stageId: "st1",
          ownerId: null,
          source: null,
          priority: null,
          estimatedValueCents: null,
          notes: null,
          nextActionAt: null,
          nextActionText: null,
          status: "OPEN",
          lossReason: null,
          createdAt: "2025-01-01T00:00:00Z",
          updatedAt: "2025-01-01T00:00:00Z",
          stage: { id: "st1", name: "Qualified", pipelineId: "p1", order: 1, colorKey: null, dealershipId: "d1", createdAt: "", updatedAt: "" },
        },
      ],
      meta: { total: 1 },
    });

    render(
      <ActiveOpportunityDealCard
        customerId="c1"
        canReadDeals={true}
        canReadCrm={true}
      />
    );

    await waitFor(() => {
      const link = screen.getByRole("link", { name: /Active opportunity — Qualified/i });
      expect(link).toHaveAttribute("href", "/crm/opportunities/opp-1");
    });
    expect(screen.getByRole("link", { name: /Open inbox/i })).toHaveAttribute("href", "/crm/inbox?customerId=c1");
    expect(screen.getByRole("link", { name: /Open pipeline context/i })).toHaveAttribute("href", "/crm/opportunities?view=list&customerId=c1");
  });
});
