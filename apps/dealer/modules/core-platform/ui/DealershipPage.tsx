"use client";

import * as React from "react";
import { apiFetch } from "@/lib/client/http";
import type {
  GetDealershipResponse,
  LocationsListResponse,
  LocationResponse,
  LocationCreateBody,
  LocationUpdateBody,
} from "@/lib/types/dealership";
import { useSession } from "@/contexts/session-context";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Pagination } from "@/components/pagination";
import {
  Dialog,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogHeader,
} from "@/components/ui/dialog";
import { MutationButton, WriteGuard } from "@/components/write-guard";
import { PageShell, PageHeader } from "@/components/ui/page-shell";

const LOCATION_FORM_INITIAL: LocationCreateBody = {
  name: "",
  addressLine1: "",
  city: "",
  region: "",
  postalCode: "",
  country: "",
  isPrimary: false,
};

export function DealershipPage() {
  const { hasPermission } = useSession();
  const { addToast } = useToast();
  const canRead = hasPermission("admin.dealership.read");
  const canWrite = hasPermission("admin.dealership.write");

  const [dealership, setDealership] = React.useState<GetDealershipResponse | null>(null);
  const [locations, setLocations] = React.useState<LocationResponse[]>([]);
  const [meta, setMeta] = React.useState<{ total: number; limit: number; offset: number }>({
    total: 0,
    limit: 25,
    offset: 0,
  });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState("");
  const [savingDealership, setSavingDealership] = React.useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = React.useState(false);
  const [editingLocation, setEditingLocation] = React.useState<LocationResponse | null>(null);
  const [locationForm, setLocationForm] = React.useState<LocationCreateBody>(LOCATION_FORM_INITIAL);
  const [savingLocation, setSavingLocation] = React.useState(false);
  const [locationFormError, setLocationFormError] = React.useState("");

  const fetchDealership = React.useCallback(async () => {
    if (!canRead) return;
    try {
      const data = await apiFetch<GetDealershipResponse>("/api/admin/dealership");
      setDealership(data);
      setEditName(data.dealership.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dealership");
    }
  }, [canRead]);

  const fetchLocations = React.useCallback(async () => {
    if (!canRead) return;
    try {
      const data = await apiFetch<LocationsListResponse>(
        `/api/admin/dealership/locations?limit=${meta.limit}&offset=${meta.offset}`
      );
      setLocations(data.data);
      setMeta(data.meta);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load locations");
    }
  }, [canRead, meta.limit, meta.offset]);

  React.useEffect(() => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([fetchDealership(), fetchLocations()]).finally(() => setLoading(false));
  }, [canRead, fetchDealership, fetchLocations]);

  const handleSaveDealership = async () => {
    if (!canWrite || !dealership) return;
    setSavingDealership(true);
    try {
      await apiFetch(`/api/admin/dealership`, {
        method: "PATCH",
        body: JSON.stringify({ name: editName }),
      });
      addToast("success", "Dealership updated");
      fetchDealership();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSavingDealership(false);
    }
  };

  const openCreateLocation = () => {
    setEditingLocation(null);
    setLocationForm(LOCATION_FORM_INITIAL);
    setLocationFormError("");
    setLocationDialogOpen(true);
  };

  const openEditLocation = (loc: LocationResponse) => {
    setEditingLocation(loc);
    setLocationForm({
      name: loc.name,
      addressLine1: loc.addressLine1 ?? "",
      addressLine2: loc.addressLine2 ?? "",
      city: loc.city ?? "",
      region: loc.region ?? "",
      postalCode: loc.postalCode ?? "",
      country: loc.country ?? "",
      isPrimary: loc.isPrimary,
    });
    setLocationFormError("");
    setLocationDialogOpen(true);
  };

  const handleSaveLocation = async () => {
    if (!canWrite) return;
    if (!locationForm.name.trim()) {
      setLocationFormError("Name is required");
      return;
    }
    setSavingLocation(true);
    setLocationFormError("");
    try {
      if (editingLocation) {
        const body: LocationUpdateBody = {
          name: locationForm.name,
          addressLine1: locationForm.addressLine1 || null,
          addressLine2: locationForm.addressLine2 || null,
          city: locationForm.city || null,
          region: locationForm.region || null,
          postalCode: locationForm.postalCode || null,
          country: locationForm.country || null,
          isPrimary: locationForm.isPrimary,
        };
        await apiFetch(`/api/admin/dealership/locations/${editingLocation.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        addToast("success", "Location updated");
      } else {
        await apiFetch("/api/admin/dealership/locations", {
          method: "POST",
          body: JSON.stringify(locationForm),
        });
        addToast("success", "Location created");
      }
      setLocationDialogOpen(false);
      fetchLocations();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSavingLocation(false);
    }
  };

  if (!canRead) {
    return (
      <PageShell>
        <PageHeader title="Dealership" description="Manage dealership details and locations." />
        <p className="mt-2 text-[var(--text-soft)]">You don’t have permission to view this page.</p>
      </PageShell>
    );
  }

  if (loading) {
    return (
      <PageShell>
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-32 w-full mb-4" />
        <Skeleton className="h-64 w-full" />
      </PageShell>
    );
  }

  if (error && !dealership) {
    return (
      <PageShell>
        <PageHeader title="Dealership" description="Manage dealership details and locations." />
        <ErrorState message={error} onRetry={() => { setError(null); fetchDealership(); fetchLocations(); }} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader title="Dealership" description="Manage your dealership and locations." />

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Details</CardTitle>
          {canWrite && (
            <WriteGuard>
              <MutationButton size="sm" onClick={handleSaveDealership} isLoading={savingDealership}>
                Save
              </MutationButton>
            </WriteGuard>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 max-w-md">
            <Input
              label="Name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              disabled={!canWrite}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Locations</CardTitle>
          {canWrite && (
            <WriteGuard>
              <Button size="sm" onClick={openCreateLocation}>
                Add location
              </Button>
            </WriteGuard>
          )}
        </CardHeader>
        <CardContent>
          {locations.length === 0 ? (
            <EmptyState
              title="No locations"
              description="Add your first location."
              actionLabel={canWrite ? "Add location" : undefined}
              onAction={canWrite ? openCreateLocation : undefined}
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Primary</TableHead>
                    {canWrite && <TableHead className="w-[100px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locations.map((loc) => (
                    <TableRow key={loc.id}>
                      <TableCell>{loc.name}</TableCell>
                      <TableCell>
                        {[loc.addressLine1, loc.city, loc.region].filter(Boolean).join(", ") || "—"}
                      </TableCell>
                      <TableCell>{loc.isPrimary ? "Yes" : "No"}</TableCell>
                      {canWrite && (
                        <TableCell>
                          <WriteGuard>
                            <Button variant="ghost" size="sm" onClick={() => openEditLocation(loc)}>
                              Edit
                            </Button>
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
                  onPageChange={(offset) => setMeta((m) => ({ ...m, offset }))}
                  className="mt-4"
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={locationDialogOpen} onOpenChange={setLocationDialogOpen}>
        <DialogHeader>
          <DialogTitle>{editingLocation ? "Edit location" : "Add location"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {locationFormError && (
            <p className="text-sm text-[var(--danger)]">{locationFormError}</p>
          )}
          <Input
            label="Name"
            value={locationForm.name}
            onChange={(e) => setLocationForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            label="Address line 1"
            value={locationForm.addressLine1}
            onChange={(e) => setLocationForm((f) => ({ ...f, addressLine1: e.target.value }))}
          />
          <Input
            label="Address line 2"
            value={locationForm.addressLine2}
            onChange={(e) => setLocationForm((f) => ({ ...f, addressLine2: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="City"
              value={locationForm.city}
              onChange={(e) => setLocationForm((f) => ({ ...f, city: e.target.value }))}
            />
            <Input
              label="Region"
              value={locationForm.region}
              onChange={(e) => setLocationForm((f) => ({ ...f, region: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Postal code"
              value={locationForm.postalCode}
              onChange={(e) => setLocationForm((f) => ({ ...f, postalCode: e.target.value }))}
            />
            <Input
              label="Country"
              value={locationForm.country}
              onChange={(e) => setLocationForm((f) => ({ ...f, country: e.target.value }))}
            />
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={locationForm.isPrimary}
              onChange={(e) => setLocationForm((f) => ({ ...f, isPrimary: e.target.checked }))}
              className="rounded border-[var(--border)]"
            />
            <span className="text-sm">Primary location</span>
          </label>
        </div>
        <DialogFooter>
          <DialogClose>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <MutationButton onClick={handleSaveLocation} isLoading={savingLocation}>
            {editingLocation ? "Save" : "Create"}
          </MutationButton>
        </DialogFooter>
      </Dialog>
    </PageShell>
  );
}
