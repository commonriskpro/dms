import { apiFetch } from "@/lib/client/http";
import type {
  SignalDomain,
  SignalDto,
} from "@/modules/intelligence/service/signal-engine";
import type { SignalSurfaceItem, SignalUiSeverity } from "@/components/ui-system/signals";

const SEVERITY_RANK: Record<SignalUiSeverity, number> = {
  danger: 0,
  warning: 1,
  info: 2,
};

export type SignalEntityScope = {
  entityType?: string;
  entityId?: string;
};

export type FetchSignalsParams = {
  domain: SignalDomain;
  includeResolved?: boolean;
  limit?: number;
  severity?: "info" | "warning" | "danger";
};

function normalizeSeverity(
  severity: SignalDto["severity"]
): SignalUiSeverity {
  if (severity === "danger") return "danger";
  if (severity === "warning") return "warning";
  return "info";
}

function countFromMetadata(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as { count?: unknown }).count;
  return typeof value === "number" ? value : null;
}

function surfaceKey(item: Pick<SignalSurfaceItem, "code" | "entityId">): string {
  return `${item.code}:${item.entityId ?? "*"}`;
}

export function sortBySeverityAndRecency(
  items: SignalSurfaceItem[]
): SignalSurfaceItem[] {
  return [...items].sort((a, b) => {
    const rankA = SEVERITY_RANK[a.severity];
    const rankB = SEVERITY_RANK[b.severity];
    if (rankA !== rankB) return rankA - rankB;
    const aTs = new Date(a.happenedAt ?? a.createdAt ?? 0).getTime();
    const bTs = new Date(b.happenedAt ?? b.createdAt ?? 0).getTime();
    if (aTs !== bTs) return bTs - aTs;
    return b.key.localeCompare(a.key);
  });
}

export function dedupeSurfaceItems(
  items: SignalSurfaceItem[]
): SignalSurfaceItem[] {
  const seen = new Set<string>();
  const out: SignalSurfaceItem[] = [];
  for (const item of items) {
    const key = surfaceKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function toSurfaceItems(signals: SignalDto[]): SignalSurfaceItem[] {
  return signals.map((signal) => {
    const key = `${signal.code}:${signal.entityId ?? "*"}:${signal.id}`;
    return {
      id: signal.id,
      key,
      code: signal.code,
      domain: signal.domain,
      title: signal.title,
      description: signal.description,
      severity: normalizeSeverity(signal.severity),
      actionLabel: signal.actionLabel ?? null,
      actionHref: signal.actionHref,
      count: countFromMetadata(signal.metadata),
      happenedAt: signal.happenedAt,
      createdAt: signal.createdAt,
      resolvedAt: signal.resolvedAt,
      entityType: signal.entityType,
      entityId: signal.entityId,
    };
  });
}

export function filterSignalsForEntity(
  items: SignalSurfaceItem[],
  scope?: SignalEntityScope,
  opts?: { allowGlobalFallback?: boolean }
): SignalSurfaceItem[] {
  if (!scope?.entityType || !scope.entityId) return items;

  const exact = items.filter(
    (item) =>
      (item.entityType ?? "").toLowerCase() === scope.entityType?.toLowerCase() &&
      item.entityId === scope.entityId
  );
  if (exact.length > 0 || !opts?.allowGlobalFallback) return exact;

  return items.filter((item) => !item.entityType && !item.entityId);
}

export function suppressByKeys(
  items: SignalSurfaceItem[],
  suppressed: string[]
): SignalSurfaceItem[] {
  if (suppressed.length === 0) return items;
  const blocked = new Set(suppressed);
  return items.filter((item) => !blocked.has(surfaceKey(item)));
}

function trim(
  items: SignalSurfaceItem[],
  maxVisible: number
): SignalSurfaceItem[] {
  return items.slice(0, Math.max(0, maxVisible));
}

export function toHeaderSignals(
  items: SignalSurfaceItem[],
  opts?: {
    maxVisible?: number;
    entity?: SignalEntityScope;
    allowGlobalFallback?: boolean;
  }
): SignalSurfaceItem[] {
  const scoped = filterSignalsForEntity(items, opts?.entity, {
    allowGlobalFallback: opts?.allowGlobalFallback,
  });
  const prepared = dedupeSurfaceItems(sortBySeverityAndRecency(scoped));
  return trim(prepared, opts?.maxVisible ?? 3);
}

export function toContextSignals(
  items: SignalSurfaceItem[],
  opts?: {
    maxVisible?: number;
    entity?: SignalEntityScope;
    suppressKeys?: string[];
    allowGlobalFallback?: boolean;
  }
): SignalSurfaceItem[] {
  const scoped = filterSignalsForEntity(items, opts?.entity, {
    allowGlobalFallback: opts?.allowGlobalFallback,
  });
  const deduped = dedupeSurfaceItems(sortBySeverityAndRecency(scoped));
  const filtered = suppressByKeys(deduped, opts?.suppressKeys ?? []);
  return trim(filtered, opts?.maxVisible ?? 5);
}

export function toQueueSignals(
  items: SignalSurfaceItem[],
  opts?: { maxVisible?: number }
): SignalSurfaceItem[] {
  const prepared = dedupeSurfaceItems(sortBySeverityAndRecency(items));
  return trim(prepared, opts?.maxVisible ?? 4);
}

/**
 * Groups surface items by entityId for queue row-level display.
 * Use with page-level signal fetch: filter in adapter by entityId per row.
 * Only includes items with entityId present; unresolved items only unless already filtered.
 */
export function groupSignalsByEntityId(
  items: SignalSurfaceItem[],
  entityIds?: Set<string> | string[]
): Map<string, SignalSurfaceItem[]> {
  const idSet =
    entityIds === undefined
      ? undefined
      : new Set(typeof entityIds === "object" && !(entityIds instanceof Set) ? entityIds : entityIds);
  const map = new Map<string, SignalSurfaceItem[]>();
  for (const item of items) {
    const eid = item.entityId ?? null;
    if (eid == null) continue;
    if (idSet !== undefined && !idSet.has(eid)) continue;
    const list = map.get(eid) ?? [];
    list.push(item);
    map.set(eid, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => {
      const rankA = SEVERITY_RANK[a.severity];
      const rankB = SEVERITY_RANK[b.severity];
      if (rankA !== rankB) return rankA - rankB;
      const aTs = new Date(a.happenedAt ?? a.createdAt ?? 0).getTime();
      const bTs = new Date(b.happenedAt ?? b.createdAt ?? 0).getTime();
      return bTs - aTs;
    });
  }
  return map;
}

export function toSignalKeys(items: SignalSurfaceItem[]): string[] {
  return items.map((item) => surfaceKey(item));
}

export async function fetchDomainSignals(
  params: FetchSignalsParams
): Promise<SignalSurfaceItem[]> {
  const query = new URLSearchParams({
    domain: params.domain,
    limit: String(params.limit ?? 25),
  });
  if (params.includeResolved) query.set("includeResolved", "true");
  if (params.severity) query.set("severity", params.severity);
  const response = await apiFetch<{ data: SignalDto[] }>(
    `/api/intelligence/signals?${query.toString()}`
  );
  return toSurfaceItems(response.data);
}

export async function fetchSignalsByDomains(
  domains: SignalDomain[],
  opts?: Omit<FetchSignalsParams, "domain">
): Promise<SignalSurfaceItem[]> {
  if (domains.length === 0) return [];
  const all = await Promise.all(
    domains.map((domain) =>
      fetchDomainSignals({
        domain,
        includeResolved: opts?.includeResolved,
        limit: opts?.limit,
        severity: opts?.severity,
      })
    )
  );
  return dedupeSurfaceItems(sortBySeverityAndRecency(all.flat()));
}
