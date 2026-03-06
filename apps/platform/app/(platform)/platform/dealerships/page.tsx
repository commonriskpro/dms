"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  platformFetch,
  type DealershipsListRes,
  type ListMeta,
  type ApiError,
} from "@/lib/api-client";
import { usePlatformAuthContext } from "@/lib/platform-auth-context";
import { useToast } from "@/components/toast";
import type { PlatformCreateDealershipRequest } from "@dms/contracts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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

const STATUS_OPTIONS: SelectOption[] = [
  { value: "", label: "All statuses" },
  { value: "APPROVED", label: "APPROVED" },
  { value: "PROVISIONING", label: "PROVISIONING" },
  { value: "PROVISIONED", label: "PROVISIONED" },
  { value: "ACTIVE", label: "ACTIVE" },
  { value: "SUSPENDED", label: "SUSPENDED" },
  { value: "CLOSED", label: "CLOSED" },
];

const LIMIT = 20;
const DEFAULT_PLAN_KEY = "starter";

export default function DealershipsListPage() {
  const { userId, role } = usePlatformAuthContext();
  const [data, setData] = useState<DealershipsListRes | null>(null);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [status, setStatus] = useState<string>("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [listVersion, setListVersion] = useState(0);
  const [newDealershipOpen, setNewDealershipOpen] = useState(false);
  const [newDealershipLoading, setNewDealershipLoading] = useState(false);
  const [newDealershipForm, setNewDealershipForm] = useState({
    legalName: "",
    displayName: "",
    planKey: DEFAULT_PLAN_KEY,
    limitsJson: "",
  });
  const toast = useToast();

  const isOwner = role === "PLATFORM_OWNER";

  const refetchList = useCallback(() => {
    setListVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params: Record<string, string> = {
      limit: String(LIMIT),
      offset: String(offset),
    };
    if (status) params.status = status;
    platformFetch<DealershipsListRes>("/api/platform/dealerships", {
      params,
      platformUserId: userId ?? undefined,
    })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setData(res.data);
          setMeta(res.data.meta);
        } else {
          setError(res.error);
          if (res.status === 403) setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [offset, status, userId, listVersion]);

  if (!userId) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-[var(--text-soft)]">You do not have access.</p>
        </CardContent>
      </Card>
    );
  }

  const handleCreateDealership = async () => {
    const legalName = newDealershipForm.legalName.trim();
    const displayName = newDealershipForm.displayName.trim();
    const planKey = newDealershipForm.planKey.trim() || DEFAULT_PLAN_KEY;
    if (!legalName || !displayName) return;
    let limits: PlatformCreateDealershipRequest["limits"] = undefined;
    if (newDealershipForm.limitsJson.trim()) {
      try {
        const parsed = JSON.parse(newDealershipForm.limitsJson.trim()) as Record<string, number | string>;
        if (Object.keys(parsed).length > 0) limits = parsed;
      } catch {
        toast("Invalid JSON for limits", "error");
        return;
      }
    }
    setNewDealershipLoading(true);
    const res = await platformFetch<{ id: string }>("/api/platform/dealerships", {
      method: "POST",
      body: JSON.stringify({ legalName, displayName, planKey, limits } as PlatformCreateDealershipRequest),
      platformUserId: userId ?? undefined,
    });
    setNewDealershipLoading(false);
    if (res.ok) {
      toast("Dealership created", "success");
      setNewDealershipOpen(false);
      setNewDealershipForm({ legalName: "", displayName: "", planKey: DEFAULT_PLAN_KEY, limitsJson: "" });
      refetchList();
    } else {
      toast(res.error.message ?? "Failed to create dealership", "error");
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-[var(--text)]">Dealerships</h1>
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error.message} {error.code === "FORBIDDEN" && "(403)"}
        </div>
      )}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Registry</CardTitle>
          <div className="flex items-center gap-2">
            {isOwner && (
              <Button
                onClick={() => {
                  setNewDealershipOpen(true);
                  setNewDealershipForm({
                    legalName: "",
                    displayName: "",
                    planKey: DEFAULT_PLAN_KEY,
                    limitsJson: "",
                  });
                }}
              >
                New Dealership
              </Button>
            )}
            <Select
              label="Status"
              options={STATUS_OPTIONS}
              value={status}
              onChange={setStatus}
              className="w-40"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : !data?.data?.length ? (
            <div className="py-12 text-center space-y-4">
              <p className="text-[var(--text-soft)]">No dealerships yet. Create one to get started.</p>
              {isOwner ? (
                <Button
                  onClick={() => {
                    setNewDealershipOpen(true);
                    setNewDealershipForm({
                      legalName: "",
                      displayName: "",
                      planKey: DEFAULT_PLAN_KEY,
                      limitsJson: "",
                    });
                  }}
                >
                  New Dealership
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Legal name</TableHead>
                    <TableHead>Display name</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Link
                          href={`/platform/dealerships/${row.id}`}
                          className="text-[var(--accent)] hover:underline"
                        >
                          {row.status}
                        </Link>
                      </TableCell>
                      <TableCell>{row.legalName}</TableCell>
                      <TableCell>{row.displayName}</TableCell>
                      <TableCell>{row.planKey}</TableCell>
                      <TableCell>{new Date(row.createdAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {meta && (
                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-[var(--text-soft)]">{meta.total} total</span>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={offset === 0}
                      onClick={() => setOffset((o) => Math.max(0, o - LIMIT))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={offset + LIMIT >= meta.total}
                      onClick={() => setOffset((o) => o + LIMIT)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={newDealershipOpen} onOpenChange={setNewDealershipOpen}>
        <DialogHeader>
          <DialogTitle>New Dealership</DialogTitle>
          <DialogDescription>
            Create a new platform dealership. Legal name and display name are required. Plan defaults to starter.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Input
            label="Legal name"
            value={newDealershipForm.legalName}
            onChange={(e) => setNewDealershipForm((f) => ({ ...f, legalName: e.target.value }))}
            placeholder="Legal entity name"
            maxLength={500}
          />
          <Input
            label="Display name"
            value={newDealershipForm.displayName}
            onChange={(e) => setNewDealershipForm((f) => ({ ...f, displayName: e.target.value }))}
            placeholder="Display name"
            maxLength={200}
          />
          <Input
            label="Plan key"
            value={newDealershipForm.planKey}
            onChange={(e) => setNewDealershipForm((f) => ({ ...f, planKey: e.target.value }))}
            placeholder="starter"
            maxLength={100}
          />
          <Input
            label="Limits (optional JSON)"
            value={newDealershipForm.limitsJson}
            onChange={(e) => setNewDealershipForm((f) => ({ ...f, limitsJson: e.target.value }))}
            placeholder='e.g. {"users": 5}'
          />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setNewDealershipOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateDealership}
            disabled={
              newDealershipLoading ||
              !newDealershipForm.legalName.trim() ||
              !newDealershipForm.displayName.trim()
            }
          >
            {newDealershipLoading ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
