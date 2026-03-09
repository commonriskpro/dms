import {
  groupSignalsByEntityId,
  toContextSignals,
  toHeaderSignals,
  toQueueSignals,
  toSignalKeys,
  type SignalEntityScope,
} from "@/modules/intelligence/ui/surface-adapters";
import type { SignalSurfaceItem } from "@/components/ui-system/signals";

function makeSignal(
  id: string,
  partial: Partial<SignalSurfaceItem> = {}
): SignalSurfaceItem {
  return {
    id,
    key: `k-${id}`,
    code: partial.code ?? `code-${id}`,
    domain: partial.domain ?? "deals",
    title: partial.title ?? `Signal ${id}`,
    severity: partial.severity ?? "info",
    happenedAt: partial.happenedAt ?? "2026-03-07T00:00:00.000Z",
    ...partial,
  };
}

describe("surface adapters", () => {
  it("applies severity-first sorting and max cap for headers", () => {
    const items = [
      makeSignal("1", { severity: "info" }),
      makeSignal("2", { severity: "danger" }),
      makeSignal("3", { severity: "warning" }),
      makeSignal("4", { severity: "danger", happenedAt: "2026-03-08T00:00:00.000Z" }),
    ];

    const result = toHeaderSignals(items, { maxVisible: 3 });
    expect(result).toHaveLength(3);
    expect(result[0]?.id).toBe("4");
    expect(result[1]?.id).toBe("2");
    expect(result[2]?.id).toBe("3");
  });

  it("enforces strict entity scope by default", () => {
    const scope: SignalEntityScope = { entityType: "Deal", entityId: "deal-1" };
    const items = [
      makeSignal("match", { entityType: "Deal", entityId: "deal-1" }),
      makeSignal("global", { entityType: null, entityId: null }),
      makeSignal("other", { entityType: "Deal", entityId: "deal-2" }),
    ];

    const header = toHeaderSignals(items, { entity: scope });
    expect(header.map((s) => s.id)).toEqual(["match"]);
  });

  it("supports explicit global fallback when requested", () => {
    const scope: SignalEntityScope = { entityType: "Vehicle", entityId: "veh-1" };
    const items = [
      makeSignal("global-1", { entityType: null, entityId: null }),
      makeSignal("global-2", { entityType: null, entityId: null, code: "shared" }),
    ];

    const header = toHeaderSignals(items, {
      entity: scope,
      allowGlobalFallback: true,
    });
    expect(header.map((s) => s.id).sort()).toEqual(["global-1", "global-2"]);
  });

  it("suppresses duplicates between header and context", () => {
    const items = [
      makeSignal("a", { code: "same.code", entityId: "deal-1", severity: "danger" }),
      makeSignal("b", { code: "other.code", entityId: "deal-1", severity: "warning" }),
    ];
    const header = toHeaderSignals(items, { maxVisible: 1 });
    const context = toContextSignals(items, {
      suppressKeys: toSignalKeys(header),
    });

    expect(header).toHaveLength(1);
    expect(context).toHaveLength(1);
    expect(context[0]?.code).not.toBe(header[0]?.code);
  });

  it("caps queue summaries to 4", () => {
    const items = [
      makeSignal("1"),
      makeSignal("2"),
      makeSignal("3"),
      makeSignal("4"),
      makeSignal("5"),
    ];
    expect(toQueueSignals(items)).toHaveLength(4);
  });

  it("groupSignalsByEntityId groups by entityId and optionally filters by id set", () => {
    const items = [
      makeSignal("a", { entityId: "deal-1", severity: "warning" }),
      makeSignal("b", { entityId: "deal-1", severity: "danger" }),
      makeSignal("c", { entityId: "deal-2", severity: "info" }),
      makeSignal("d", { entityType: "Deal", entityId: null }),
    ];
    const all = groupSignalsByEntityId(items);
    expect(all.size).toBe(2);
    expect(all.get("deal-1")?.map((s) => s.id)).toEqual(["b", "a"]); // severity: danger then warning
    expect(all.get("deal-2")?.map((s) => s.id)).toEqual(["c"]);

    const filtered = groupSignalsByEntityId(items, new Set(["deal-1"]));
    expect(filtered.size).toBe(1);
    expect(filtered.get("deal-1")?.length).toBe(2);
    expect(filtered.get("deal-2")).toBeUndefined();
  });
});
