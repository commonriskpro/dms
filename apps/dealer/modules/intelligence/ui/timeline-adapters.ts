import type { SignalSurfaceItem } from "@/components/ui-system/signals";
import { dedupeSurfaceItems, filterSignalsForEntity, sortBySeverityAndRecency } from "./surface-adapters";

export type TimelineSignalEvent = {
  id: string;
  key: string;
  title: string;
  timestamp: string;
  detail?: string;
  kind: "created" | "resolved";
  /** Source signal for UI to derive explanation (problem / why it matters / next action). */
  signal?: SignalSurfaceItem;
};

function buildCreatedEvent(signal: SignalSurfaceItem): TimelineSignalEvent {
  const ts = signal.happenedAt ?? signal.createdAt ?? new Date(0).toISOString();
  return {
    id: `${signal.id}:created`,
    key: `${signal.code}:${signal.entityId ?? "*"}:created:${ts}`,
    title: `Signal created: ${signal.title}`,
    timestamp: ts,
    detail: signal.description ?? undefined,
    kind: "created",
    signal,
  };
}

function buildResolvedEvent(signal: SignalSurfaceItem): TimelineSignalEvent | null {
  if (!signal.resolvedAt) return null;
  return {
    id: `${signal.id}:resolved`,
    key: `${signal.code}:${signal.entityId ?? "*"}:resolved:${signal.resolvedAt}`,
    title: `Signal resolved: ${signal.title}`,
    timestamp: signal.resolvedAt,
    detail: signal.description ?? undefined,
    kind: "resolved",
    signal,
  };
}

export function toTimelineSignalEvents(
  signals: SignalSurfaceItem[],
  opts?: {
    maxVisible?: number;
    entity?: { entityType?: string; entityId?: string };
    allowGlobalFallback?: boolean;
  }
): TimelineSignalEvent[] {
  const scoped = filterSignalsForEntity(signals, opts?.entity, {
    allowGlobalFallback: opts?.allowGlobalFallback,
  });
  const prioritized = dedupeSurfaceItems(sortBySeverityAndRecency(scoped));

  const events: TimelineSignalEvent[] = [];
  for (const signal of prioritized) {
    events.push(buildCreatedEvent(signal));
    const resolved = buildResolvedEvent(signal);
    if (resolved) events.push(resolved);
  }

  const dedupedEvents = Array.from(
    new Map(events.map((event) => [event.key, event])).values()
  );
  dedupedEvents.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  return dedupedEvents.slice(0, opts?.maxVisible ?? 8);
}
