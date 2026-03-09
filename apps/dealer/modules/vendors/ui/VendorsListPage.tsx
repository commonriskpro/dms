"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/client/http";
import { getApiErrorMessage } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/pagination";
import { Select, type SelectOption } from "@/components/ui/select";
import {
  Dialog,
  DialogTitle,
  DialogFooter,
  DialogHeader,
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
import { MutationButton, WriteGuard } from "@/components/write-guard";
import type { Vendor, VendorsListResponse, VendorType } from "@/lib/types/vendors";
import { VENDOR_TYPE_OPTIONS } from "@/lib/types/vendors";

const DEFAULT_LIMIT = 25;
const vendorTypeSelectOptions: SelectOption[] = VENDOR_TYPE_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));

function contactHint(v: Vendor): string {
  if (v.contactName?.trim()) return v.contactName.trim();
  const parts = [v.phone?.trim(), v.email?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export function VendorsListPage() {
  const searchParams = useSearchParams();
  const { hasPermission } = useSession();
  const { addToast } = useToast();
  const canRead = hasPermission("inventory.read");
  const canWrite = hasPermission("inventory.write");

  const [list, setList] = React.useState<Vendor[]>([]);
  const [meta, setMeta] = React.useState({
    total: 0,
    limit: DEFAULT_LIMIT,
    offset: 0,
  });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<string>("");
  const [includeDeleted, setIncludeDeleted] = React.useState(false);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editingVendor, setEditingVendor] = React.useState<Vendor | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deletingVendor, setDeletingVendor] = React.useState<Vendor | null>(null);

  const [formName, setFormName] = React.useState("");
  const [formType, setFormType] = React.useState<VendorType>("other");
  const [formContactName, setFormContactName] = React.useState("");
  const [formPhone, setFormPhone] = React.useState("");
  const [formEmail, setFormEmail] = React.useState("");
  const [formAddress, setFormAddress] = React.useState("");
  const [formNotes, setFormNotes] = React.useState("");
  const [formIsActive, setFormIsActive] = React.useState(true);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = React.useState(false);

  const fetchVendors = React.useCallback(
    async (offset = 0) => {
      if (!canRead) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          limit: String(DEFAULT_LIMIT),
          offset: String(offset),
        });
        if (search.trim()) params.set("search", search.trim());
        if (typeFilter) params.set("type", typeFilter);
        if (includeDeleted) params.set("includeDeleted", "true");
        const res = await apiFetch<VendorsListResponse>(
          `/api/vendors?${params.toString()}`
        );
        setList(res.data ?? []);
        setMeta(res.meta ?? { total: 0, limit: DEFAULT_LIMIT, offset: 0 });
      } catch (e) {
        setError(getApiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [canRead, search, typeFilter, includeDeleted]
  );

  React.useEffect(() => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    fetchVendors(0);
  }, [canRead, fetchVendors]);

  const editIdFromUrl = searchParams.get("edit");
  React.useEffect(() => {
    if (!editIdFromUrl || !canRead || !canWrite) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch<{ data: Vendor }>(
          `/api/vendors/${editIdFromUrl}`
        );
        if (!cancelled && res.data) {
          const v = res.data;
          setEditingVendor(v);
          setFormName(v.name);
          setFormType(v.type);
          setFormContactName(v.contactName ?? "");
          setFormPhone(v.phone ?? "");
          setFormEmail(v.email ?? "");
          setFormAddress(v.address ?? "");
          setFormNotes(v.notes ?? "");
          setFormIsActive(v.isActive);
          setFormError(null);
          setEditOpen(true);
        }
      } catch {
        if (!cancelled) addToast("error", "Vendor not found");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editIdFromUrl, canRead, canWrite, addToast]);

  const openCreate = () => {
    setFormName("");
    setFormType("other");
    setFormContactName("");
    setFormPhone("");
    setFormEmail("");
    setFormAddress("");
    setFormNotes("");
    setFormIsActive(true);
    setFormError(null);
    setCreateOpen(true);
  };

  const openEdit = (v: Vendor) => {
    setEditingVendor(v);
    setFormName(v.name);
    setFormType(v.type);
    setFormContactName(v.contactName ?? "");
    setFormPhone(v.phone ?? "");
    setFormEmail(v.email ?? "");
    setFormAddress(v.address ?? "");
    setFormNotes(v.notes ?? "");
    setFormIsActive(v.isActive);
    setFormError(null);
    setEditOpen(true);
  };

  const openDelete = (v: Vendor) => {
    setDeletingVendor(v);
    setDeleteOpen(true);
  };

  const handleCreate = async () => {
    if (!canWrite) return;
    if (!formName.trim()) {
      setFormError("Name is required.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await apiFetch<{ data: Vendor }>("/api/vendors", {
        method: "POST",
        body: JSON.stringify({
          name: formName.trim(),
          type: formType,
          contactName: formContactName.trim() || null,
          phone: formPhone.trim() || null,
          email: formEmail.trim() || null,
          address: formAddress.trim() || null,
          notes: formNotes.trim() || null,
          isActive: formIsActive,
        }),
      });
      addToast("success", "Vendor created");
      setCreateOpen(false);
      fetchVendors(meta.offset);
    } catch (e) {
      setFormError(getApiErrorMessage(e));
      addToast("error", getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!canWrite || !editingVendor) return;
    if (!formName.trim()) {
      setFormError("Name is required.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await apiFetch<{ data: Vendor }>(`/api/vendors/${editingVendor.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: formName.trim(),
          type: formType,
          contactName: formContactName.trim() || null,
          phone: formPhone.trim() || null,
          email: formEmail.trim() || null,
          address: formAddress.trim() || null,
          notes: formNotes.trim() || null,
          isActive: formIsActive,
        }),
      });
      addToast("success", "Vendor updated");
      setEditOpen(false);
      setEditingVendor(null);
      fetchVendors(meta.offset);
    } catch (e) {
      setFormError(getApiErrorMessage(e));
      addToast("error", getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!canWrite || !deletingVendor) return;
    setDeleteSubmitting(true);
    try {
      await apiFetch<{ data: Vendor }>(`/api/vendors/${deletingVendor.id}`, {
        method: "DELETE",
      });
      addToast("success", "Vendor removed");
      setDeleteOpen(false);
      setDeletingVendor(null);
      fetchVendors(meta.offset);
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  if (!canRead) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6">
        <p className="text-[var(--text-soft)]">
          You don&apos;t have access to vendors.
        </p>
      </div>
    );
  }

  if (loading && list.length === 0) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-[var(--text)]">Vendors</h1>
        {canWrite && (
          <WriteGuard>
            <Button onClick={openCreate} aria-label="Create vendor">
              Create vendor
            </Button>
          </WriteGuard>
        )}
      </div>

      {error && list.length === 0 && (
        <ErrorState
          title="Failed to load vendors"
          message={error}
          onRetry={() => fetchVendors(0)}
        />
      )}

      {!error && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vendor directory</CardTitle>
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Input
                  placeholder="Search by name"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchVendors(0)}
                  className="max-w-xs"
                />
                <Select
                  options={[
                    { value: "", label: "All types" },
                    ...vendorTypeSelectOptions,
                  ]}
                  value={typeFilter}
                  onChange={setTypeFilter}
                />
                <label className="flex items-center gap-2 text-sm text-[var(--text-soft)]">
                  <input
                    type="checkbox"
                    checked={includeDeleted}
                    onChange={(e) => setIncludeDeleted(e.target.checked)}
                    className="rounded border-[var(--border)]"
                    aria-label="Include removed vendors"
                  />
                  Include removed
                </label>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => fetchVendors(0)}
                >
                  Apply
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {list.length === 0 ? (
                <EmptyState
                  title="No vendors"
                  description="Create a vendor for cost entries and documents."
                  actionLabel={canWrite ? "Create vendor" : undefined}
                  onAction={canWrite ? openCreate : undefined}
                />
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead className="text-right">
                          Cost entries
                        </TableHead>
                        {canWrite && (
                          <TableHead aria-label="Actions"></TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {list.map((v) => (
                        <TableRow key={v.id}>
                          <TableCell className="font-medium">
                            {v.deletedAt ? (
                              <span className="text-[var(--muted-text)]">
                                {v.name}
                              </span>
                            ) : (
                              <Link
                                href={`/vendors/${v.id}`}
                                className="text-[var(--accent)] hover:underline"
                              >
                                {v.name}
                              </Link>
                            )}
                          </TableCell>
                          <TableCell>
                            {VENDOR_TYPE_OPTIONS.find((o) => o.value === v.type)
                              ?.label ?? v.type}
                          </TableCell>
                          <TableCell className="text-[var(--muted-text)]">
                            {contactHint(v)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {v.costEntryCount ?? 0}
                          </TableCell>
                          {canWrite && (
                            <TableCell>
                              <WriteGuard>
                                {!v.deletedAt && (
                                  <>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="secondary"
                                      onClick={() => openEdit(v)}
                                      aria-label={`Edit ${v.name}`}
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="secondary"
                                      onClick={() => openDelete(v)}
                                      className="ml-1"
                                      aria-label={`Remove ${v.name}`}
                                    >
                                      Remove
                                    </Button>
                                  </>
                                )}
                              </WriteGuard>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {meta.total > meta.limit && (
                    <Pagination
                      meta={meta}
                      onPageChange={(offset) => fetchVendors(offset)}
                      className="mt-4"
                    />
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogHeader>
          <DialogTitle>Create vendor</DialogTitle>
          <DialogDescription>
            Add a vendor for cost entries (auction, transport, repair, etc.).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Input
            label="Name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Vendor name"
            required
          />
          <Select
            label="Type"
            options={vendorTypeSelectOptions}
            value={formType}
            onChange={(v) => setFormType(v as VendorType)}
          />
          <Input
            label="Contact name"
            value={formContactName}
            onChange={(e) => setFormContactName(e.target.value)}
            placeholder="Optional"
          />
          <Input
            label="Phone"
            value={formPhone}
            onChange={(e) => setFormPhone(e.target.value)}
            placeholder="Optional"
          />
          <Input
            label="Email"
            type="email"
            value={formEmail}
            onChange={(e) => setFormEmail(e.target.value)}
            placeholder="Optional"
          />
          <Input
            label="Address"
            value={formAddress}
            onChange={(e) => setFormAddress(e.target.value)}
            placeholder="Optional"
          />
          <Input
            label="Notes"
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
            placeholder="Optional"
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formIsActive}
              onChange={(e) => setFormIsActive(e.target.checked)}
              className="rounded border-[var(--border)]"
              aria-label="Active"
            />
            <span className="text-sm">Active</span>
          </label>
          {formError && (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {formError}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => setCreateOpen(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <MutationButton onClick={handleCreate} disabled={submitting}>
            {submitting ? "Creating…" : "Create"}
          </MutationButton>
        </DialogFooter>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => !submitting && setEditOpen(open)}
      >
        <DialogHeader>
          <DialogTitle>Edit vendor</DialogTitle>
          <DialogDescription>Update vendor details.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Input
            label="Name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Vendor name"
            required
          />
          <Select
            label="Type"
            options={vendorTypeSelectOptions}
            value={formType}
            onChange={(v) => setFormType(v as VendorType)}
          />
          <Input
            label="Contact name"
            value={formContactName}
            onChange={(e) => setFormContactName(e.target.value)}
          />
          <Input
            label="Phone"
            value={formPhone}
            onChange={(e) => setFormPhone(e.target.value)}
          />
          <Input
            label="Email"
            type="email"
            value={formEmail}
            onChange={(e) => setFormEmail(e.target.value)}
          />
          <Input
            label="Address"
            value={formAddress}
            onChange={(e) => setFormAddress(e.target.value)}
          />
          <Input
            label="Notes"
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formIsActive}
              onChange={(e) => setFormIsActive(e.target.checked)}
              className="rounded border-[var(--border)]"
              aria-label="Active"
            />
            <span className="text-sm">Active</span>
          </label>
          {formError && (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {formError}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => setEditOpen(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <MutationButton onClick={handleUpdate} disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </MutationButton>
        </DialogFooter>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => !deleteSubmitting && setDeleteOpen(open)}
      >
        <DialogHeader>
          <DialogTitle>Remove vendor?</DialogTitle>
          <DialogDescription>
            This will soft-delete the vendor. They will no longer appear in
            pickers or the default list. Existing cost entries linked to this
            vendor will still show the vendor name. You can include removed
            vendors with the filter to see them again.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => setDeleteOpen(false)}
            disabled={deleteSubmitting}
          >
            Cancel
          </Button>
          <MutationButton
            variant="secondary"
            onClick={handleDelete}
            disabled={deleteSubmitting}
          >
            {deleteSubmitting ? "Removing…" : "Remove"}
          </MutationButton>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
