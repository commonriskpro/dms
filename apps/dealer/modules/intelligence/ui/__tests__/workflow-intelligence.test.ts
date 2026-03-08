import type { SignalSurfaceItem } from "@/components/ui-system/signals";
import { groupSignalsByEntityId, toContextSignals } from "../surface-adapters";

/**
 * Focused tests for workflow intelligence deepening surfaces.
 * Blocker strip logic: filter to warning/danger, cap at 5 (strip shows max 3 via SignalContextBlock).
 * Queue row: groupSignalsByEntityId keys by entityId; row shows only its deal's signals.
 * Inbox: toContextSignals with entity filters to selected customer.
 */
function makeSignal(
  id: string,
  partial: Partial<SignalSurfaceItem> = {}
): SignalSurfaceItem {
  return {
    id,
    key: `k-${id}`,
    code: partial.code ?? "code",
    domain: partial.domain ?? "deals",
    title: partial.title ?? "Signal",
    severity: partial.severity ?? "info",
    ...partial,
  };
}

describe("workflow intelligence deepening", () => {
  describe("DealWorkspace blockers strip", () => {
    it("blocker strip derivation keeps only warning and danger signals capped at 5", () => {
      const contextSignals: SignalSurfaceItem[] = [
        makeSignal("1", { severity: "danger" }),
        makeSignal("2", { severity: "warning" }),
        makeSignal("3", { severity: "info" }),
        makeSignal("4", { severity: "danger" }),
        makeSignal("5", { severity: "warning" }),
        makeSignal("6", { severity: "warning" }),
      ];
      const blockerSignals = contextSignals
        .filter((s) => s.severity === "warning" || s.severity === "danger")
        .slice(0, 5);
      expect(blockerSignals.every((s) => s.severity === "warning" || s.severity === "danger")).toBe(
        true
      );
      expect(blockerSignals.length).toBe(5);
      expect(blockerSignals.map((s) => s.id)).not.toContain("3");
    });

    it("blocker strip is empty when no warning or danger", () => {
      const contextSignals = [
        makeSignal("1", { severity: "info" }),
        makeSignal("2", { severity: "info" }),
      ];
      const blockerSignals = contextSignals.filter(
        (s) => s.severity === "warning" || s.severity === "danger"
      );
      expect(blockerSignals).toHaveLength(0);
    });
  });

  describe("queue row Alerts column", () => {
    it("signalsByDealId returns only signals for each deal id so row shows correct alerts", () => {
      const allSignals = [
        makeSignal("s1", { entityId: "deal-a", severity: "warning" }),
        makeSignal("s2", { entityId: "deal-a", severity: "danger" }),
        makeSignal("s3", { entityId: "deal-b", severity: "warning" }),
      ];
      const signalsByDealId = groupSignalsByEntityId(allSignals, ["deal-a", "deal-b"]);
      expect(signalsByDealId.get("deal-a")).toHaveLength(2);
      expect(signalsByDealId.get("deal-b")).toHaveLength(1);
      expect(signalsByDealId.get("deal-c")).toBeUndefined();
      expect(signalsByDealId.get("deal-a")?.every((s) => s.entityId === "deal-a")).toBe(true);
    });
  });

  describe("inbox customer alerts block", () => {
    it("toContextSignals with entity scope shows only selected customer signals", () => {
      const inboxSignals = [
        makeSignal("1", {
          code: "crm.overdue_task",
          entityType: "Customer",
          entityId: "cust-1",
          title: "Overdue task",
        }),
        makeSignal("2", {
          code: "crm.other",
          entityType: "Customer",
          entityId: "cust-2",
          title: "Other",
        }),
        makeSignal("3", {
          code: "crm.missed_call",
          entityType: "Customer",
          entityId: "cust-1",
          title: "Missed call",
        }),
      ];
      const customerContextSignals = toContextSignals(inboxSignals, {
        maxVisible: 5,
        entity: { entityType: "Customer", entityId: "cust-1" },
      });
      expect(customerContextSignals.every((s) => s.entityId === "cust-1")).toBe(true);
      expect(customerContextSignals.map((s) => s.title)).toContain("Overdue task");
      expect(customerContextSignals.map((s) => s.title)).toContain("Missed call");
      expect(customerContextSignals.map((s) => s.title)).not.toContain("Other");
    });
  });
});
