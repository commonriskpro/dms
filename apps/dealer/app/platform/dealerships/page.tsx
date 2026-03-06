"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/http";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Pagination } from "@/components/pagination";

type DealershipRow = {
  id: string;
  name: string;
  slug?: string;
  isActive: boolean;
  createdAt: string;
  locationsCount: number;
  membersCount: number;
};

type ListResponse = {
  data: DealershipRow[];
  meta: { total: number; limit: number; offset: number };
};

export default function PlatformDealershipsPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [data, setData] = React.useState<DealershipRow[]>([]);
  const [meta, setMeta] = React.useState({ total: 0, limit: 20, offset: 0 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createName, setCreateName] = React.useState("");
  const [createSlug, setCreateSlug] = React.useState("");
  const [createDefaultLocation, setCreateDefaultLocation] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [disableTarget, setDisableTarget] = React.useState<DealershipRow | null>(null);
  const [enableTarget, setEnableTarget] = React.useState<DealershipRow | null>(null);
  const [actioning, setActioning] = React.useState(false);

  const fetchList = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(meta.limit));
      params.set("offset", String(meta.offset));
      if (search.trim()) params.set("search", search.trim());
      const res = await apiFetch<ListResponse>(`/api/platform/dealerships?${params}`);
      setData(res.data);
      setMeta((m) => ({ ...m, total: res.meta.total }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [meta.limit, meta.offset, search]);

  React.useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setCreating(true);
    try {
      await apiFetch("/api/platform/dealerships", {
        method: "POST",
        body: JSON.stringify({
          name: createName.trim(),
          slug: createSlug.trim() || undefined,
          createDefaultLocation,
        }),
      });
      addToast("success", "Dealership created");
      setCreateOpen(false);
      setCreateName("");
      setCreateSlug("");
      setCreateDefaultLocation(true);
      fetchList();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  const handleDisable = async (row: DealershipRow) => {
    setActioning(true);
    try {
      await apiFetch(`/api/platform/dealerships/${row.id}/disable`, { method: "POST" });
      addToast("success", "Dealership disabled");
      setDisableTarget(null);
      fetchList();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Disable failed");
    } finally {
      setActioning(false);
    }
  };

  const handleEnable = async (row: DealershipRow) => {
    setActioning(true);
    try {
      await apiFetch(`/api/platform/dealerships/${row.id}/enable`, { method: "POST" });
      addToast("success", "Dealership enabled");
      setEnableTarget(null);
      fetchList();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Enable failed");
    } finally {
      setActioning(false);
    }
  };

  const handleImpersonate = async (row: DealershipRow) => {
    try {
      await apiFetch("/api/platform/impersonate", {
        method: "POST",
        body: JSON.stringify({ dealershipId: row.id }),
        expectNoContent: true,
      });
      addToast("success", "Impersonating dealership. Redirecting…");
      router.push("/inventory");
      router.refresh();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Impersonate failed");
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-[var(--text)]">Platform Admin — Dealerships</h1>
      <p className="mt-1 text-sm text-[var(--text-soft)]">Create and manage dealerships.</p>

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Dealerships</CardTitle>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search name/slug"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchList()}
              className="w-48"
              aria-label="Search by name or slug"
            />
            <Button variant="secondary" onClick={fetchList}>
              Apply
            </Button>
            <Button onClick={() => setCreateOpen(true)}>Create dealership</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && data.length === 0 ? (
            <ErrorState message={error} onRetry={fetchList} />
          ) : loading && data.length === 0 ? (
            <>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-64 w-full" />
            </>
          ) : data.length === 0 ? (
            <EmptyState
              title="No dealerships"
              description="Create your first dealership to get started."
              actionLabel="Create dealership"
              onAction={() => setCreateOpen(true)}
            />
          ) : (
            <>
              <div className="rounded-md border border-[var(--border)] overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead>Members</TableHead>
                      <TableHead>Locations</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Link
                          href={`/platform/dealerships/${row.id}`}
                          className="font-medium text-[var(--accent)] hover:underline"
                        >
                          {row.name}
                        </Link>
                      </TableCell>
                      <TableCell>{row.slug ?? "—"}</TableCell>
                      <TableCell>{row.isActive ? "Yes" : "No"}</TableCell>
                      <TableCell>{row.membersCount}</TableCell>
                      <TableCell>{row.locationsCount}</TableCell>
                      <TableCell>{new Date(row.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <Link href={`/platform/dealerships/${row.id}`}>
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </Link>
                        {row.isActive ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDisableTarget(row)}
                            className="text-amber-600"
                          >
                            Disable
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEnableTarget(row)}
                            className="text-green-600"
                          >
                            Enable
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleImpersonate(row)}
                        >
                          Impersonate
                        </Button>
                      </TableCell>
                    </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination
                meta={meta}
                onPageChange={(offset) => setMeta((m) => ({ ...m, offset }))}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent aria-describedby="create-dealership-desc">
          <DialogHeader>
            <DialogTitle>Create dealership</DialogTitle>
          </DialogHeader>
          <p id="create-dealership-desc" className="sr-only">
            Enter dealership name and optional slug. Optionally create a default location.
          </p>
          <div className="space-y-3">
            <div>
              <label htmlFor="create-dealership-name" className="block text-sm font-medium text-[var(--text)]">
                Name
              </label>
              <Input
                id="create-dealership-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Dealership name"
                aria-required="true"
              />
            </div>
            <div>
              <label htmlFor="create-dealership-slug" className="block text-sm font-medium text-[var(--text)]">
                Slug (optional)
              </label>
              <Input
                id="create-dealership-slug"
                value={createSlug}
                onChange={(e) => setCreateSlug(e.target.value)}
                placeholder="slug"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="create-dealership-default-location"
                checked={createDefaultLocation}
                onChange={(e) => setCreateDefaultLocation(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--border)]"
                aria-describedby="create-default-location-desc"
              />
              <label
                htmlFor="create-dealership-default-location"
                id="create-default-location-desc"
                className="text-sm text-[var(--text)]"
              >
                Create default location
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!createName.trim() || creating}>
              {creating ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!disableTarget} onOpenChange={() => setDisableTarget(null)}>
        <DialogContent aria-describedby="disable-dealership-desc">
          <DialogHeader>
            <DialogTitle>Disable dealership</DialogTitle>
          </DialogHeader>
          <p id="disable-dealership-desc" className="text-sm text-[var(--text-soft)]">
            Are you sure you want to disable &quot;{disableTarget?.name}&quot;? All memberships will be disabled and users will lose access until you re-enable the dealership and their memberships.
          </p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDisableTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => disableTarget && handleDisable(disableTarget)}
              disabled={actioning}
            >
              {actioning ? "Disabling…" : "Disable"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!enableTarget} onOpenChange={() => setEnableTarget(null)}>
        <DialogContent aria-describedby="enable-dealership-desc">
          <DialogHeader>
            <DialogTitle>Enable dealership</DialogTitle>
          </DialogHeader>
          <p id="enable-dealership-desc" className="text-sm text-[var(--text-soft)]">
            Are you sure you want to enable &quot;{enableTarget?.name}&quot;? You will need to re-enable individual memberships for users to regain access.
          </p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEnableTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => enableTarget && handleEnable(enableTarget)}
              disabled={actioning}
            >
              {actioning ? "Enabling…" : "Enable"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
