import { toTimelineSignalEvents } from "@/modules/intelligence/ui/timeline-adapters";
import type { SignalSurfaceItem } from "@/components/ui-system/signals";

function makeSignal(
  id: string,
  partial: Partial<SignalSurfaceItem> = {}
): SignalSurfaceItem {
  return {
    id,
    key: `k-${id}`,
    code: partial.code ?? `code-${id}`,
    domain: partial.domain ?? "inventory",
    title: partial.title ?? `Signal ${id}`,
    severity: partial.severity ?? "info",
    happenedAt: partial.happenedAt ?? "2026-03-07T00:00:00.000Z",
    ...partial,
  };
}

describe("timeline adapters", () => {
  it("maps created and resolved lifecycle events", () => {
    const items = [
      makeSignal("open", { title: "Open signal" }),
      makeSignal("resolved", {
        title: "Resolved signal",
        resolvedAt: "2026-03-08T10:00:00.000Z",
      }),
    ];

    const events = toTimelineSignalEvents(items, { maxVisible: 10 });
    const titles = events.map((e) => e.title);

    expect(titles).toContain("Signal created: Open signal");
    expect(titles).toContain("Signal created: Resolved signal");
    expect(titles).toContain("Signal resolved: Resolved signal");
  });

  it("scopes timeline events by entity", () => {
    const items = [
      makeSignal("match", { entityType: "Customer", entityId: "c1" }),
      makeSignal("other", { entityType: "Customer", entityId: "c2" }),
      makeSignal("global", { entityType: null, entityId: null }),
    ];

    const events = toTimelineSignalEvents(items, {
      entity: { entityType: "Customer", entityId: "c1" },
      maxVisible: 10,
    });
    expect(events.every((event) => event.id.startsWith("match:"))).toBe(true);
  });

  it("obeys max-visible limit", () => {
    const items = [
      makeSignal("1"),
      makeSignal("2"),
      makeSignal("3"),
      makeSignal("4"),
      makeSignal("5"),
    ];
    expect(toTimelineSignalEvents(items, { maxVisible: 3 })).toHaveLength(3);
  });

  it("attaches source signal to events for timeline explanation rendering", () => {
    const items = [
      makeSignal("a", { title: "Funding delay", entityId: "deal-1" }),
      makeSignal("b", { title: "Title hold", resolvedAt: "2026-03-08T12:00:00.000Z" }),
    ];
    const events = toTimelineSignalEvents(items, { maxVisible: 10 });
    expect(events.length).toBeGreaterThan(0);
    events.forEach((event) => {
      expect(event).toHaveProperty("signal");
      expect(event.signal).toBeDefined();
      expect(event.signal?.title).toBeDefined();
    });
    const created = events.find((e) => e.kind === "created" && e.signal?.id === "a");
    expect(created?.signal?.title).toBe("Funding delay");
  });
});
