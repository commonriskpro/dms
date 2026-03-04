"use client";

import * as React from "react";
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
import type {
  Lender,
  LendersListResponse,
  LenderType,
  LenderExternalSystem,
} from "@/lib/types/lenders";
import {
  LENDER_TYPE_OPTIONS,
  LENDER_EXTERNAL_SYSTEM_OPTIONS,
} from "@/lib/types/lenders";

const DEFAULT_LIMIT = 25;

/** Permission gate: when false, no GET /api/lenders fetch. Used by tests. */
export function shouldFetchLenders(canRead: boolean): boolean {
  return !!canRead;
}

const lenderTypeSelectOptions: SelectOption[] = LENDER_TYPE_OPTIONS.map(
  (o) => ({ value: o.value, label: o.label })
);
const externalSystemSelectOptions: SelectOption[] =
  LENDER_EXTERNAL_SYSTEM_OPTIONS.map((o) => ({ value: o.value, label: o.label }));

export function LendersDirectoryPage() {
  const { hasPermission } = useSession();
  const { addToast } = useToast();
  const canRead = hasPermission("lenders.read");
  const canWrite = hasPermission("lenders.write");

  const [list, setList] = React.useState<Lender[]>([]);
  const [meta, setMeta] = React.useState({
    total: 0,
    limit: DEFAULT_LIMIT,
    offset: 0,
  });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeOnly, setActiveOnly] = React.useState(true);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editingLender, setEditingLender] = React.useState<Lender | null>(null);
  const [deactivateOpen, setDeactivateOpen] = React.useState(false);
  const [deactivatingLender, setDeactivatingLender] = React.useState<Lender | null>(null);

  const [formName, setFormName] = React.useState("");
  const [formType, setFormType] = React.useState<LenderType>("BANK");
  const [formExternalSystem, setFormExternalSystem] =
    React.useState<LenderExternalSystem>("NONE");
  const [formContactEmail, setFormContactEmail] = React.useState("");
  const [formContactPhone, setFormContactPhone] = React.useState("");
  const [formIsActive, setFormIsActive] = React.useState(true);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [deactivateSubmitting, setDeactivateSubmitting] = React.useState(false);

  const fetchLenders = React.useCallback(
    async (offset = 0) => {
      if (!shouldFetchLenders(canRead)) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          limit: String(DEFAULT_LIMIT),
          offset: String(offset),
        });
        if (activeOnly) params.set("isActive", "true");
        const res = await apiFetch<LendersListResponse>(`/api/lenders?${params.toString()}`);
        setList(res.data ?? []);
        setMeta(res.meta ?? { total: 0, limit: DEFAULT_LIMIT, offset: 0 });
      } catch (e) {
        setError(getApiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [canRead, activeOnly]
  );

  React.useEffect(() => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    fetchLenders(0);
  }, [canRead, fetchLenders]);

  const openCreate = () => {
    setFormName("");
    setFormType("BANK");
    setFormExternalSystem("NONE");
    setFormContactEmail("");
    setFormContactPhone("");
    setFormIsActive(true);
    setFormError(null);
    setCreateOpen(true);
  };

  const openEdit = (lender: Lender) => {
    setEditingLender(lender);
    setFormName(lender.name);
    setFormType(lender.lenderType);
    setFormExternalSystem(lender.externalSystem);
    setFormContactEmail(lender.contactEmail ?? "");
    setFormContactPhone(lender.contactPhone ?? "");
    setFormIsActive(lender.isActive);
    setFormError(null);
    setEditOpen(true);
  };

  const openDeactivate = (lender: Lender) => {
    setDeactivatingLender(lender);
    setDeactivateOpen(true);
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
      await apiFetch<{ data: Lender }>("/api/lenders", {
        method: "POST",
        body: JSON.stringify({
          name: formName.trim(),
          lenderType: formType,
          externalSystem: formExternalSystem,
          contactEmail: formContactEmail.trim() || undefined,
          contactPhone: formContactPhone.trim() || undefined,
          isActive: formIsActive,
        }),
      });
      addToast("success", "Lender created");
      setCreateOpen(false);
      fetchLenders(meta.offset);
    } catch (e) {
      setFormError(getApiErrorMessage(e));
      addToast("error", getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!canWrite || !editingLender) return;
    if (!formName.trim()) {
      setFormError("Name is required.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await apiFetch<{ data: Lender }>(`/api/lenders/${editingLender.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: formName.trim(),
          lenderType: formType,
          externalSystem: formExternalSystem,
          contactEmail: formContactEmail.trim() || undefined,
          contactPhone: formContactPhone.trim() || undefined,
          isActive: formIsActive,
        }),
      });
      addToast("success", "Lender updated");
      setEditOpen(false);
      setEditingLender(null);
      fetchLenders(meta.offset);
    } catch (e) {
      setFormError(getApiErrorMessage(e));
      addToast("error", getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async () => {
    if (!canWrite || !deactivatingLender) return;
    setDeactivateSubmitting(true);
    try {
      await apiFetch(`/api/lenders/${deactivatingLender.id}`, {
        method: "DELETE",
        expectNoContent: true,
      });
      addToast("success", "Lender deactivated");
      setDeactivateOpen(false);
      setDeactivatingLender(null);
      fetchLenders(meta.offset);
    } catch (e) {
      addToast("error", getApiErrorMessage(e));
    } finally {
      setDeactivateSubmitting(false);
    }
  };

  if (!canRead) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6">
        <p className="text-[var(--text-soft)]">You don&apos;t have access to lenders.</p>
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
        <h1 className="text-2xl font-semibold text-[var(--text)]">Lenders</h1>
        {canWrite && (
          <WriteGuard>
            <Button onClick={openCreate} aria-label="Create lender">
              Create lender
            </Button>
          </WriteGuard>
        )}
      </div>

      {error && list.length === 0 && (
        <ErrorState title="Failed to load lenders" message={error} onRetry={() => fetchLenders(0)} />
      )}

      {!error && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lender directory</CardTitle>
              <div className="flex items-center gap-2 pt-2">
                <label className="flex items-center gap-2 text-sm text-[var(--text-soft)]">
                  <input
                    type="checkbox"
                    checked={activeOnly}
                    onChange={(e) => setActiveOnly(e.target.checked)}
                    className="rounded border-[var(--border)]"
                    aria-label="Show active only"
                  />
                  Active only
                </label>
              </div>
            </CardHeader>
            <CardContent>
              {list.length === 0 ? (
                <EmptyState
                  title="No lenders"
                  description="Create a lender to get started."
                  actionLabel={canWrite ? "Create lender" : undefined}
                  onAction={canWrite ? openCreate : undefined}
                />
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>External system</TableHead>
                        <TableHead>Active</TableHead>
                        {canWrite && <TableHead aria-label="Actions"></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {list.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell className="font-medium">{l.name}</TableCell>
                          <TableCell>{l.lenderType}</TableCell>
                          <TableCell>{l.externalSystem}</TableCell>
                          <TableCell>{l.isActive ? "Yes" : "No"}</TableCell>
                          {canWrite && (
                            <TableCell>
                              <WriteGuard>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => openEdit(l)}
                                  aria-label={`Edit ${l.name}`}
                                >
                                  Edit
                                </Button>
                                {l.isActive && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => openDeactivate(l)}
                                    className="ml-1"
                                    aria-label={`Deactivate ${l.name}`}
                                  >
                                    Deactivate
                                  </Button>
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
                      onPageChange={(offset) => fetchLenders(offset)}
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
          <DialogTitle>Create lender</DialogTitle>
          <DialogDescription>
            Add a lender to the directory. No secrets are stored.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Input
            label="Name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Lender name"
            required
          />
          <Select
            label="Type"
            options={lenderTypeSelectOptions}
            value={formType}
            onChange={(v) => setFormType(v as LenderType)}
          />
          <Select
            label="External system"
            options={externalSystemSelectOptions}
            value={formExternalSystem}
            onChange={(v) => setFormExternalSystem(v as LenderExternalSystem)}
          />
          <Input
            label="Contact email"
            type="email"
            value={formContactEmail}
            onChange={(e) => setFormContactEmail(e.target.value)}
            placeholder="optional"
          />
          <Input
            label="Contact phone"
            value={formContactPhone}
            onChange={(e) => setFormContactPhone(e.target.value)}
            placeholder="optional"
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
          <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <MutationButton onClick={handleCreate} disabled={submitting}>
            {submitting ? "Creating…" : "Create"}
          </MutationButton>
        </DialogFooter>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={(open) => !submitting && setEditOpen(open)}>
        <DialogHeader>
          <DialogTitle>Edit lender</DialogTitle>
          <DialogDescription>Update lender details.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Input
            label="Name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Lender name"
            required
          />
          <Select
            label="Type"
            options={lenderTypeSelectOptions}
            value={formType}
            onChange={(v) => setFormType(v as LenderType)}
          />
          <Select
            label="External system"
            options={externalSystemSelectOptions}
            value={formExternalSystem}
            onChange={(v) => setFormExternalSystem(v as LenderExternalSystem)}
          />
          <Input
            label="Contact email"
            type="email"
            value={formContactEmail}
            onChange={(e) => setFormContactEmail(e.target.value)}
          />
          <Input
            label="Contact phone"
            value={formContactPhone}
            onChange={(e) => setFormContactPhone(e.target.value)}
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
          <Button variant="secondary" onClick={() => setEditOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <MutationButton onClick={handleUpdate} disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </MutationButton>
        </DialogFooter>
      </Dialog>

      <Dialog
        open={deactivateOpen}
        onOpenChange={(open) => !deactivateSubmitting && setDeactivateOpen(open)}
      >
        <DialogHeader>
          <DialogTitle>Deactivate lender?</DialogTitle>
          <DialogDescription>
            This will set the lender as inactive. They will no longer appear in the active
            directory. You can re-enable them by editing. This is not a hard delete.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => setDeactivateOpen(false)}
            disabled={deactivateSubmitting}
          >
            Cancel
          </Button>
          <MutationButton
            variant="secondary"
            onClick={handleDeactivate}
            disabled={deactivateSubmitting}
          >
            {deactivateSubmitting ? "Deactivating…" : "Deactivate"}
          </MutationButton>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
