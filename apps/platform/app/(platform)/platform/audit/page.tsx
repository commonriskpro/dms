"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  platformFetch,
  type ApiError,
} from "@/lib/api-client";
import { usePlatformAuthContext } from "@/lib/platform-auth-context";
import { buildAuditQueryParams } from "@/lib/audit-query-params";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, type SelectOption } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isValidUUID(s: string): boolean {
  return UUID_REGEX.test(s.trim());
}

const TARGET_TYPE_OPTIONS: SelectOption[] = [
  { value: "", label: "All types" },
  { value: "application", label: "Application" },
  { value: "dealership", label: "Dealership" },
  { value: "platform_user", label: "Platform user" },
];

type AuditEntry = {
  id: string;
  actorPlatformUserId: string;
  action: string;
  targetType: string;
  targetId: string | null;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  reason: string | null;
  requestId: string | null;
  idempotencyKey: string | null;
  createdAt: string;
};

type AuditRes = {
  data: AuditEntry[];
  meta: { limit: number; offset: number; total: number };
};

/** Keys that differ between before and after (shallow value comparison via JSON.stringify). */
function getChangedKeys(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): string[] {
  const keys = new Set<string>([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);
  const changed: string[] = [];
  for (const k of keys) {
    const b = (before ?? {})[k];
    const a = (after ?? {})[k];
    if (JSON.stringify(b) !== JSON.stringify(a)) changed.push(k);
  }
  return changed.sort();
}

const DEFAULT_LIMIT = 20;

export default function AuditLogsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userId } = usePlatformAuthContext();

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [meta, setMeta] = useState<{ limit: number; offset: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const [action, setAction] = useState("");
  const [targetType, setTargetType] = useState("");
  const [targetTypeCustom, setTargetTypeCustom] = useState("");
  const [targetId, setTargetId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [actor, setActor] = useState("");
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [offset, setOffset] = useState(0);

  const [targetIdError, setTargetIdError] = useState("");
  const [actorError, setActorError] = useState("");

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailEntry, setDetailEntry] = useState<AuditEntry | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<ApiError | null>(null);

  const effectiveTargetType = targetType === "other" || targetType === "" ? targetTypeCustom.trim() : targetType;

  const syncFiltersFromUrl = useCallback(() => {
    setAction(searchParams.get("action") ?? "");
    setTargetType(searchParams.get("targetType") ?? "");
    setTargetTypeCustom(searchParams.get("targetTypeCustom") ?? "");
    setTargetId(searchParams.get("targetId") ?? "");
    setDateFrom(searchParams.get("dateFrom") ?? "");
    setDateTo(searchParams.get("dateTo") ?? "");
    setActor(searchParams.get("actor") ?? "");
    const l = searchParams.get("limit");
    setLimit(l ? Math.min(100, Math.max(1, parseInt(l, 10)) || DEFAULT_LIMIT) : DEFAULT_LIMIT);
    const o = searchParams.get("offset");
    setOffset(o ? Math.max(0, parseInt(o, 10) || 0) : 0);
  }, [searchParams]);

  useEffect(() => {
    syncFiltersFromUrl();
  }, [syncFiltersFromUrl]);

  const updateUrl = useCallback(
    (updates: {
      action?: string;
      targetType?: string;
      targetTypeCustom?: string;
      targetId?: string;
      dateFrom?: string;
      dateTo?: string;
      actor?: string;
      limit?: number;
      offset?: number;
      detail?: string;
    }) => {
      const params = new URLSearchParams(searchParams.toString());
      const set = (key: string, value: string | number | undefined) => {
        if (value === undefined || value === "") params.delete(key);
        else params.set(key, String(value));
      };
      if (updates.action !== undefined) set("action", updates.action);
      if (updates.targetType !== undefined) set("targetType", updates.targetType);
      if (updates.targetTypeCustom !== undefined) set("targetTypeCustom", updates.targetTypeCustom);
      if (updates.targetId !== undefined) set("targetId", updates.targetId);
      if (updates.dateFrom !== undefined) set("dateFrom", updates.dateFrom);
      if (updates.dateTo !== undefined) set("dateTo", updates.dateTo);
      if (updates.actor !== undefined) set("actor", updates.actor);
      if (updates.limit !== undefined) set("limit", updates.limit);
      if (updates.offset !== undefined) set("offset", updates.offset);
      if (updates.detail !== undefined) set("detail", updates.detail);
      router.replace(`/platform/audit?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const fetchAuditFromUrl = useCallback(() => {
    const actionVal = searchParams.get("action") ?? "";
    const targetTypeVal = searchParams.get("targetType") ?? "";
    const targetTypeCustomVal = searchParams.get("targetTypeCustom") ?? "";
    const targetIdVal = searchParams.get("targetId") ?? "";
    const dateFromVal = searchParams.get("dateFrom") ?? "";
    const dateToVal = searchParams.get("dateTo") ?? "";
    const actorVal = searchParams.get("actor") ?? "";
    const limitVal = searchParams.get("limit");
    const offsetVal = searchParams.get("offset");
    const limitNum = limitVal ? Math.min(100, Math.max(1, parseInt(limitVal, 10)) || DEFAULT_LIMIT) : DEFAULT_LIMIT;
    const offsetNum = offsetVal ? Math.max(0, parseInt(offsetVal, 10) || 0) : 0;
    const effectiveType = targetTypeVal === "other" ? targetTypeCustomVal.trim() : targetTypeVal;
    const params = buildAuditQueryParams({
      action: actionVal.trim() || undefined,
      targetType: effectiveType || undefined,
      targetId: targetIdVal.trim() && isValidUUID(targetIdVal) ? targetIdVal.trim() : undefined,
      dateFrom: dateFromVal.trim() || undefined,
      dateTo: dateToVal.trim() || undefined,
      actor: actorVal.trim() || undefined,
      limit: limitNum,
      offset: offsetNum,
    });
    setLoading(true);
    const qs = new URLSearchParams(params).toString();
    platformFetch<AuditRes>(`/api/platform/audit?${qs}`, {
      platformUserId: userId ?? undefined,
    })
      .then((res) => {
        if (res.ok) {
          setEntries(res.data.data);
          setMeta(res.data.meta);
          setOffset(offsetNum);
        } else {
          setError(res.error);
          setEntries([]);
          setMeta(null);
        }
      })
      .finally(() => setLoading(false));
  }, [searchParams, userId]);

  useEffect(() => {
    fetchAuditFromUrl();
  }, [fetchAuditFromUrl]);

  useEffect(() => {
    if (targetId.trim()) {
      setTargetIdError(isValidUUID(targetId) ? "" : "Enter a valid UUID");
    } else {
      setTargetIdError("");
    }
  }, [targetId]);

  useEffect(() => {
    if (actor.trim()) {
      setActorError(isValidUUID(actor) ? "" : "Enter a valid UUID");
    } else {
      setActorError("");
    }
  }, [actor]);

  const handleFilterApply = () => {
    if ((targetId.trim() && !isValidUUID(targetId)) || (actor.trim() && !isValidUUID(actor))) return;
    updateUrl({
      action: action.trim() || undefined,
      targetType: targetType || undefined,
      targetTypeCustom: targetTypeCustom.trim() || undefined,
      targetId: targetId.trim() || undefined,
      dateFrom: dateFrom.trim() || undefined,
      dateTo: dateTo.trim() || undefined,
      actor: actor.trim() || undefined,
      limit,
      offset: 0,
    });
  };

  const handlePrev = () => {
    if (meta && offset > 0) {
      const newOffset = Math.max(0, offset - limit);
      updateUrl({ offset: newOffset });
    }
  };

  const handleNext = () => {
    if (meta && offset + limit < meta.total) {
      const newOffset = offset + limit;
      updateUrl({ offset: newOffset });
    }
  };

  const fetchDetailById = (id: string) => {
    setDetailId(id);
    setDetailEntry(null);
    setDetailError(null);
    setDetailLoading(true);
    platformFetch<AuditEntry>(`/api/platform/audit/${id}`, {
      platformUserId: userId ?? undefined,
    })
      .then((res) => {
        if (res.ok) setDetailEntry(res.data);
        else setDetailError(res.error);
      })
      .finally(() => setDetailLoading(false));
  };

  const openDetail = (id: string) => {
    updateUrl({ detail: id });
    fetchDetailById(id);
  };

  const closeDetail = () => {
    updateUrl({ detail: undefined });
  };

  useEffect(() => {
    const detail = searchParams.get("detail");
    if (!detail) {
      setDetailId(null);
      setDetailEntry(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }
    if (detail !== detailId) {
      fetchDetailById(detail);
    }
  }, [searchParams, detailId]);

  const changedKeys =
    detailEntry?.beforeState != null || detailEntry?.afterState != null
      ? getChangedKeys(detailEntry.beforeState ?? null, detailEntry.afterState ?? null)
      : [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-[var(--text)]">Audit Logs</h1>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Narrow by action, target type, target ID, or date range. Filters are stored in the URL.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Input
            label="Action contains"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="e.g. provision, dealership"
            className="max-w-xs"
          />
          <div className="max-w-xs">
            <Select
              label="Target type"
              options={[...TARGET_TYPE_OPTIONS, { value: "other", label: "Other (use custom below)" }]}
              value={targetType}
              onChange={setTargetType}
            />
            {targetType === "other" && (
              <Input
                label="Target type (custom)"
                value={targetTypeCustom}
                onChange={(e) => setTargetTypeCustom(e.target.value)}
                placeholder="e.g. custom_type"
                className="mt-2"
              />
            )}
          </div>
          <Input
            label="Target ID (UUID)"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            placeholder="UUID"
            className="max-w-xs"
            error={targetIdError || undefined}
          />
          <Input
            label="Date from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="max-w-xs"
          />
          <Input
            label="Date to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="max-w-xs"
          />
          <Input
            label="Actor (UUID)"
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            placeholder="Actor user ID"
            className="max-w-xs"
            error={actorError || undefined}
          />
          <div className="flex items-end gap-2">
            <Button
              variant="secondary"
              onClick={handleFilterApply}
              disabled={!!(targetId.trim() && !isValidUUID(targetId)) || !!(actor.trim() && !isValidUUID(actor))}
            >
              Apply filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error.message}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
          {meta && (
            <CardDescription>
              {meta.total} total · page {Math.floor(offset / limit) + 1}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {loading && !entries.length ? (
            <Skeleton className="h-64 w-full" />
          ) : !entries.length ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-[var(--text-soft)]">No audit entries match your filters.</p>
              <p className="text-sm text-[var(--text-soft)]">
                Try adjusting filters or date range, or wait for new activity.
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Created</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target type</TableHead>
                    <TableHead>Target ID</TableHead>
                    <TableHead aria-label="View detail">
                      <span className="sr-only">View</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer"
                      onClick={() => openDetail(row.id)}
                    >
                      <TableCell>
                        {new Date(row.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-[var(--text-soft)]">
                        {row.actorPlatformUserId.slice(0, 8)}…
                      </TableCell>
                      <TableCell>{row.action}</TableCell>
                      <TableCell>{row.targetType}</TableCell>
                      <TableCell className="font-mono text-xs text-[var(--text-soft)]">
                        {row.targetId ? (
                          row.targetType === "dealership" ? (
                            <Link
                              href={`/platform/dealerships/${row.targetId}`}
                              className="text-[var(--accent)] hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {row.targetId.slice(0, 8)}… — Jump to dealership
                            </Link>
                          ) : (
                            `${row.targetId.slice(0, 8)}…`
                          )
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDetail(row.id);
                          }}
                          aria-label={`View audit entry ${row.id}`}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {meta && meta.total > limit && (
                <div className="flex items-center gap-2 mt-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handlePrev}
                    disabled={offset === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleNext}
                    disabled={offset + limit >= meta.total}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detailId} onOpenChange={(open) => !open && closeDetail()}>
        <div>
          <DialogHeader>
            <DialogTitle>Audit entry</DialogTitle>
            {detailEntry && (
              <DialogDescription>
                {detailEntry.action} at {new Date(detailEntry.createdAt).toLocaleString()}
              </DialogDescription>
            )}
          </DialogHeader>
          {detailLoading && (
            <div className="py-6">
              <Skeleton className="h-32 w-full" />
            </div>
          )}
          {detailError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
              {detailError.message}
            </div>
          )}
          {!detailLoading && !detailError && detailEntry && (
            <div className="space-y-4 text-sm">
              {changedKeys.length > 0 && (
                <div className="rounded-md border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2">
                  <p className="font-medium text-[var(--text)]">Changed keys:</p>
                  <p className="font-mono text-xs text-[var(--text-soft)] mt-1">
                    {changedKeys.join(", ")}
                  </p>
                </div>
              )}
              {(detailEntry.requestId || detailEntry.idempotencyKey) && (
                <div className="rounded-md border border-[var(--border)] px-3 py-2 space-y-1">
                  {detailEntry.requestId && (
                    <p>
                      <span className="font-medium text-[var(--text-soft)]">Request ID:</span>{" "}
                      <span className="font-mono text-xs">{detailEntry.requestId}</span>
                    </p>
                  )}
                  {detailEntry.idempotencyKey && (
                    <p>
                      <span className="font-medium text-[var(--text-soft)]">Idempotency key:</span>{" "}
                      <span className="font-mono text-xs">{detailEntry.idempotencyKey}</span>
                    </p>
                  )}
                </div>
              )}
              <dl className="grid gap-2">
                <div>
                  <dt className="font-medium text-[var(--text-soft)]">ID</dt>
                  <dd className="font-mono text-xs">{detailEntry.id}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[var(--text-soft)]">Actor</dt>
                  <dd className="font-mono text-xs">{detailEntry.actorPlatformUserId}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[var(--text-soft)]">Action</dt>
                  <dd>{detailEntry.action}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[var(--text-soft)]">Target type</dt>
                  <dd>{detailEntry.targetType}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[var(--text-soft)]">Target ID</dt>
                  <dd className="font-mono text-xs">{detailEntry.targetId ?? "—"}</dd>
                </div>
                {detailEntry.reason && (
                  <div>
                    <dt className="font-medium text-[var(--text-soft)]">Reason</dt>
                    <dd>{detailEntry.reason}</dd>
                  </div>
                )}
                <div>
                  <dt className="font-medium text-[var(--text-soft)]">Created</dt>
                  <dd>{new Date(detailEntry.createdAt).toLocaleString()}</dd>
                </div>
              </dl>
              {((detailEntry.beforeState && Object.keys(detailEntry.beforeState).length > 0) ||
                (detailEntry.afterState && Object.keys(detailEntry.afterState).length > 0)) && (
                <div className="space-y-2">
                  {detailEntry.beforeState && Object.keys(detailEntry.beforeState).length > 0 && (
                    <details className="rounded border border-[var(--border)]">
                      <summary className="cursor-pointer px-3 py-2 font-medium text-[var(--text-soft)] hover:bg-[var(--muted)]/50">
                        Before state
                      </summary>
                      <pre className="p-3 bg-[var(--muted)] text-xs overflow-auto max-h-48 border-t border-[var(--border)]">
                        {JSON.stringify(detailEntry.beforeState, null, 2)}
                      </pre>
                    </details>
                  )}
                  {detailEntry.afterState && Object.keys(detailEntry.afterState).length > 0 && (
                    <details className="rounded border border-[var(--border)]">
                      <summary className="cursor-pointer px-3 py-2 font-medium text-[var(--text-soft)] hover:bg-[var(--muted)]/50">
                        After state
                      </summary>
                      <pre className="p-3 bg-[var(--muted)] text-xs overflow-auto max-h-48 border-t border-[var(--border)]">
                        {JSON.stringify(detailEntry.afterState, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}
