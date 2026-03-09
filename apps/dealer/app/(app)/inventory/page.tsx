import { unstable_noStore as noStore } from "next/cache";
import { getSessionContextOrNull } from "@/lib/api/handler";
import {
  getInventoryPageOverview,
  inventoryPageQuerySchema,
} from "@/modules/inventory/service/inventory-page";
import { getInventoryListViewPreference } from "@/modules/inventory/service/inventory-list-view-preference";
import { InventoryPageContentV2 } from "@/modules/inventory/ui/InventoryPageContentV2";
import { InventoryListContent } from "@/modules/inventory/ui/InventoryListContent";
import { PageShell } from "@/components/ui/page-shell";

export const dynamic = "force-dynamic";

export default async function InventoryRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  noStore();
  const session = await getSessionContextOrNull();
  const dealershipId = session?.activeDealershipId ?? null;
  const userId = session?.userId ?? null;
  const permissions = session?.permissions ?? [];
  const hasInventoryRead = permissions.includes("inventory.read");
  const canWrite = permissions.includes("inventory.write");

  if (!hasInventoryRead || !dealershipId || !userId) {
    return (
      <PageShell>
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]">
          <p className="text-[var(--muted-text)]">You don&apos;t have access to inventory.</p>
        </div>
      </PageShell>
    );
  }

  const raw = await searchParams;
  const single = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v[0] : v;

  const view = single(raw.view);

  const rawQuery: Record<string, unknown> = {};
  if (single(raw.page) !== undefined) rawQuery.page = single(raw.page);
  if (single(raw.pageSize) !== undefined) rawQuery.pageSize = single(raw.pageSize);
  if (single(raw.status) !== undefined) rawQuery.status = single(raw.status);
  if (single(raw.search) !== undefined) rawQuery.search = single(raw.search);
  if (single(raw.minPrice) !== undefined) rawQuery.minPrice = single(raw.minPrice);
  if (single(raw.maxPrice) !== undefined) rawQuery.maxPrice = single(raw.maxPrice);
  if (single(raw.locationId) !== undefined) rawQuery.locationId = single(raw.locationId);
  if (single(raw.sortBy) !== undefined) rawQuery.sortBy = single(raw.sortBy);
  if (single(raw.sortOrder) !== undefined) rawQuery.sortOrder = single(raw.sortOrder);
  if (single(raw.over90Only) !== undefined) rawQuery.over90Only = single(raw.over90Only);
  if (single(raw.missingPhotosOnly) !== undefined) rawQuery.missingPhotosOnly = single(raw.missingPhotosOnly);
  if (single(raw.floorPlannedOnly) !== undefined) rawQuery.floorPlannedOnly = single(raw.floorPlannedOnly);

  const query = inventoryPageQuerySchema.parse(rawQuery);
  const overview = await getInventoryPageOverview(
    { dealershipId, userId, permissions },
    rawQuery
  );

  const currentQuery: Record<string, string | number | undefined> = {
    page: query.page,
    pageSize: query.pageSize,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
  };
  if (query.status) currentQuery.status = query.status;
  if (query.search) currentQuery.search = query.search;
  if (query.minPrice != null) currentQuery.minPrice = query.minPrice;
  if (query.maxPrice != null) currentQuery.maxPrice = query.maxPrice;
  if (query.locationId) currentQuery.locationId = query.locationId;
  if (query.over90Only) currentQuery.over90Only = 1;
  if (query.missingPhotosOnly) currentQuery.missingPhotosOnly = 1;
  if (query.floorPlannedOnly) currentQuery.floorPlannedOnly = 1;

  if (view === "list") {
    const savedView = await getInventoryListViewPreference({ dealershipId, userId });
    const initialViewMode = savedView === "cards" ? "cards" : "table";

    return (
      <InventoryListContent
        initialData={overview}
        currentQuery={currentQuery}
        canWrite={canWrite}
        initialViewMode={initialViewMode}
      />
    );
  }

  return (
    <InventoryPageContentV2
      initialData={overview}
      currentQuery={currentQuery}
      canWrite={canWrite}
    />
  );
}
