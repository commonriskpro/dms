import * as React from "react";
import { render, screen } from "@testing-library/react";
import {
  SignalBlockerInline,
  SignalContextBlock,
  SignalExplanationItem,
  SignalHeaderBadgeGroup,
  SignalQueueSummary,
  SignalSummaryPanel,
  type SignalSurfaceItem,
} from "@/components/ui-system";

const SIGNALS: SignalSurfaceItem[] = [
  {
    id: "1",
    key: "ops:1",
    code: "ops.alert",
    domain: "operations",
    title: "Funding queue delay",
    description: "Queue SLA breached",
    severity: "danger",
    count: 7,
  },
  {
    id: "2",
    key: "inv:1",
    code: "inventory.recon",
    domain: "inventory",
    title: "Recon backlog",
    description: "Units waiting for recon",
    severity: "warning",
    count: 3,
  },
];

describe("signal surface primitives", () => {
  it("renders summary and context lists", () => {
    render(
      <>
        <SignalSummaryPanel title="Intelligence" items={SIGNALS} />
        <SignalContextBlock title="Context" items={SIGNALS} />
      </>
    );

    expect(screen.getByText("Intelligence")).toBeInTheDocument();
    expect(screen.getByText("Context")).toBeInTheDocument();
    expect(screen.getAllByText("Funding queue delay").length).toBeGreaterThan(0);
  });

  it("caps header badge group visibility", () => {
    render(<SignalHeaderBadgeGroup items={SIGNALS} maxVisible={1} />);

    expect(screen.getByText("Funding queue delay")).toBeInTheDocument();
    expect(screen.queryByText("Recon backlog")).not.toBeInTheDocument();
  });

  it("renders queue summary KPI cards", () => {
    render(<SignalQueueSummary items={SIGNALS} />);
    expect(screen.getByText("Funding queue delay")).toBeInTheDocument();
    expect(screen.getByText("Recon backlog")).toBeInTheDocument();
  });

  it("renders SignalExplanationItem with problem and whyItMatters", () => {
    render(
      <SignalExplanationItem
        explanation={{
          problem: "Funding delayed",
          whyItMatters: "Slows cash collection.",
          nextAction: { label: "Review", href: "/deals/1" },
        }}
      />
    );
    expect(screen.getByText("Funding delayed")).toBeInTheDocument();
    expect(screen.getByText("Slows cash collection.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review" })).toHaveAttribute("href", "/deals/1");
  });

  it("renders SignalBlockerInline with issue count", () => {
    render(<SignalBlockerInline items={SIGNALS.slice(0, 2)} maxCount={3} />);
    expect(screen.getByText("2 issues")).toBeInTheDocument();
  });
});
