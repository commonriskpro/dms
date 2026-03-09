import { toSignalExplanation } from "../explanation-adapters";
import type { SignalSurfaceItem } from "@/components/ui-system/signals";

function makeItem(partial: Partial<SignalSurfaceItem> = {}): SignalSurfaceItem {
  return {
    id: "s1",
    key: "k1",
    code: "deals.funding_delay",
    domain: "deals",
    title: "Funding delayed",
    severity: "warning",
    ...partial,
  };
}

describe("explanation-adapters", () => {
  it("uses title as problem", () => {
    const out = toSignalExplanation(makeItem({ title: "Custom title" }));
    expect(out.problem).toBe("Custom title");
  });

  it("uses description as whyItMatters when present", () => {
    const out = toSignalExplanation(
      makeItem({ description: "Slows cash flow." })
    );
    expect(out.whyItMatters).toBe("Slows cash flow.");
  });

  it("falls back to code-based whyItMatters when description empty", () => {
    const out = toSignalExplanation(makeItem({ description: null }));
    expect(out.whyItMatters).toContain("cash");
  });

  it("uses actionHref and actionLabel for nextAction when present", () => {
    const out = toSignalExplanation(
      makeItem({ actionHref: "/deals/1", actionLabel: "Open deal" })
    );
    expect(out.nextAction).toEqual({ label: "Open deal", href: "/deals/1" });
  });

  it("uses code fallback for nextAction when no actionHref", () => {
    const out = toSignalExplanation(makeItem({ code: "deals.funding_delay" }));
    expect(out.nextAction).not.toBeNull();
    expect(out.nextAction?.label).toBeDefined();
    expect(out.nextAction?.href).toBeDefined();
  });

  it("returns null nextAction when no href and no code fallback", () => {
    const out = toSignalExplanation(
      makeItem({ code: "unknown.code", actionHref: null })
    );
    expect(out.nextAction).toBeNull();
  });
});
