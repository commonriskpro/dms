import { apiFetch, HttpError } from "@/lib/client/http";
import type { SignalListItem } from "@/components/ui-system/signals";
import type { WidgetRow } from "./types";

/** Only surface toast for actionable failures (5xx, network). Skip AbortError and 4xx (expected/empty). */
export function shouldToastSignalError(e: unknown): boolean {
  if (typeof e === "object" && e !== null && "name" in e && (e as { name: string }).name === "AbortError")
    return false;
  if (e instanceof HttpError && e.status < 500) return false;
  return true;
}

type SignalDomain = "inventory" | "crm" | "deals" | "operations" | "acquisition";
type SignalSeverity = "info" | "success" | "warning" | "danger";

type ApiSignal = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  severity: SignalSeverity;
  actionHref: string | null;
  metadata?: { count?: unknown } | null;
};

function extractCount(metadata: ApiSignal["metadata"]): number | null {
  const value = metadata?.count;
  return typeof value === "number" ? value : null;
}

function mapApiSignalsToItems(signals: ApiSignal[]): SignalListItem[] {
  return signals.map((signal) => ({
    id: signal.id,
    title: signal.title,
    description: signal.description ?? undefined,
    severity: signal.severity,
    actionHref: signal.actionHref ?? undefined,
    count: extractCount(signal.metadata),
  }));
}

export function mapWidgetRowsToSignalItems(
  rows: WidgetRow[],
  hrefByKey: Record<string, string>
): SignalListItem[] {
  return rows.map((row) => ({
    id: row.key,
    title: row.label,
    description: `${row.count} total`,
    severity: row.severity ?? "info",
    actionHref: row.href ?? hrefByKey[row.key],
    count: row.count,
  }));
}

export async function fetchDomainSignalItems(
  domain: SignalDomain,
  signal?: AbortSignal
): Promise<SignalListItem[]> {
  const response = await apiFetch<{ data: ApiSignal[] }>(
    `/api/intelligence/signals?domain=${domain}&limit=5`,
    { signal }
  );
  return mapApiSignalsToItems(response.data);
}
