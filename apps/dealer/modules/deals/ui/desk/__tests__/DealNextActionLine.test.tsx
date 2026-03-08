/**
 * DealNextActionLine: next action from blockers.
 * Spec: CUSTOMER_DEAL_WORKFLOW_FLOW_REFINEMENT_SPEC.md
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { DealNextActionLine } from "../DealNextActionLine";
import type { SignalSurfaceItem } from "@/components/ui-system/signals";

describe("DealNextActionLine", () => {
  it("shows No blocking actions when blockerSignals is empty", () => {
    render(<DealNextActionLine blockerSignals={[]} />);
    expect(screen.getByText("Next: No blocking actions.")).toBeInTheDocument();
  });

  it("shows first blocker action when present", () => {
    const signals: SignalSurfaceItem[] = [
      {
        id: "1",
        key: "k1",
        code: "deals.funding_delay",
        domain: "deals",
        title: "Funding delayed",
        severity: "warning",
        actionLabel: "Open funding queue",
        actionHref: "/deals/funding",
      },
    ];
    render(<DealNextActionLine blockerSignals={signals} />);
    const link = screen.getByRole("link", { name: "Open funding queue" });
    expect(link).toHaveAttribute("href", "/deals/funding");
    expect(screen.getByText(/Next:/)).toBeInTheDocument();
  });

  it("shows No blocking actions when first signal has no action", () => {
    const signals: SignalSurfaceItem[] = [
      {
        id: "1",
        key: "k1",
        code: "deals.hold",
        domain: "deals",
        title: "Deal on hold",
        severity: "warning",
      },
    ];
    render(<DealNextActionLine blockerSignals={signals} />);
    expect(screen.getByText("Next: No blocking actions.")).toBeInTheDocument();
  });
});
