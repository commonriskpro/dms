/**
 * NextActionZone: workflow next-action zone (customer page).
 * Spec: CUSTOMER_DEAL_WORKFLOW_FLOW_REFINEMENT_SPEC.md
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { NextActionZone } from "../NextActionZone";
import type { SignalSurfaceItem } from "@/components/ui-system/signals";
import type { CustomerCallbackItem } from "@/lib/types/customers";

const noSignals: SignalSurfaceItem[] = [];
const noCallbacks: CustomerCallbackItem[] = [];

describe("NextActionZone", () => {
  it("returns null when no primary and no risk line", () => {
    const { container } = render(
      <NextActionZone
        contextSignals={noSignals}
        callbacks={noCallbacks}
        customerId="c1"
        canReadCrm={false}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows Open conversation when canReadCrm and no signals/callbacks", () => {
    render(
      <NextActionZone
        contextSignals={noSignals}
        callbacks={noCallbacks}
        customerId="cust-123"
        canReadCrm={true}
      />
    );
    expect(screen.getByRole("region", { name: "Next action" })).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Open conversation" });
    expect(link).toHaveAttribute("href", "/crm/inbox?customerId=cust-123");
  });

  it("shows primary from first signal with action", () => {
    const signals: SignalSurfaceItem[] = [
      {
        id: "1",
        key: "k1",
        code: "crm.overdue",
        domain: "crm",
        title: "Overdue callback",
        severity: "warning",
        actionLabel: "View callbacks",
        actionHref: "/customers/c1#callbacks",
      },
    ];
    render(
      <NextActionZone
        contextSignals={signals}
        callbacks={noCallbacks}
        customerId="c1"
        canReadCrm={true}
      />
    );
    const link = screen.getByRole("link", { name: "Overdue callback" });
    expect(link).toHaveAttribute("href", "/customers/c1#callbacks");
    expect(screen.getByText(/Next:/)).toBeInTheDocument();
  });

  it("shows callback due when scheduled callback exists", () => {
    const callbacks: CustomerCallbackItem[] = [
      {
        id: "cb1",
        callbackAt: "2025-06-15T10:00:00Z",
        status: "SCHEDULED",
        reason: "Follow up",
        assignedToUserId: null,
        snoozedUntil: null,
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      },
    ];
    render(
      <NextActionZone
        contextSignals={noSignals}
        callbacks={callbacks}
        customerId="c1"
        canReadCrm={true}
      />
    );
    expect(screen.getByText(/Callback due/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Callback due/ });
    expect(link).toHaveAttribute("href", "/crm/inbox?customerId=c1");
  });

  it("shows risk line when warning/danger signal without duplicate of primary", () => {
    const signals: SignalSurfaceItem[] = [
      {
        id: "1",
        key: "k1",
        code: "crm.stale",
        domain: "crm",
        title: "Stale lead",
        severity: "danger",
      },
    ];
    render(
      <NextActionZone
        contextSignals={signals}
        callbacks={noCallbacks}
        customerId="c1"
        canReadCrm={true}
      />
    );
    expect(screen.getByText(/Risk:/)).toBeInTheDocument();
    expect(screen.getByText(/Stale lead/)).toBeInTheDocument();
  });
});
