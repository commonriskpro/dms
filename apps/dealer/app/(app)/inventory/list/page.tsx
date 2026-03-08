import { unstable_noStore as noStore } from "next/cache";
import { getSessionContextOrNull } from "@/lib/api/handler";
import {
  getInventoryPageOverview,
  inventoryPageQuerySchema,
} from "@/modules/inventory/service/inventory-page";
import { getInventoryListViewPreference } from "@/modules/inventory/service/inventory-list-view-preference";
import { InventoryListContent } from "@/modules/inventory/ui/InventoryListContent";
import { PageShell } from "@/components/ui/page-shell";

export const dynamic = "force-dynamic";

export default async function InventoryListRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  noStore();
  const session = await getSessionContextOrNull();
  const dealershipId = session?.activeDealershipId ?? null;
  const userId       = session?.userId ?? null;
  const permissions  = session?.permissions ?? [];
  const hasRead  = permissions.includes("inventory.read");
  const canWrite = permissions.includes("inventory.write");

  if (!hasRead || !dealershipId || !userId) {
    return (
      <PageShell>
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]">
          <p className="text-[var(--muted-text)]">You don&apos;t have access to inventory.</p>
        </div>
      </PageShell>
    );
  }

  const raw = await searchParams;
  const flatRaw: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v != null) flatRaw[k] = Array.isArray(v) ? v[0] : v;
  }

  const parsed = inventoryPageQuerySchema.safeParse(flatRaw);
  const query  = parsed.success ? parsed.data : inventoryPageQuerySchema.parse({});

  const initialData = await getInventoryPageOverview(
    { dealershipId, userId, permissions },
    query
  ).catch(() => null);

  if (!initialData) {
    return (
      <PageShell>
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]">
          <p className="text-[var(--muted-text)]">Failed to load inventory.</p>
        </div>
      </PageShell>
    );
  }

  const currentQuery: Record<string, string | number | undefined> = {
    page:      query.page,
    pageSize:  query.pageSize,
    sortBy:    query.sortBy,
    sortOrder: query.sortOrder,
    ...(query.status    ? { status:    query.status }    : {}),
    ...(query.search    ? { search:    query.search }    : {}),
    ...(query.minPrice  ? { minPrice:  query.minPrice }  : {}),
    ...(query.maxPrice  ? { maxPrice:  query.maxPrice }  : {}),
    ...(query.locationId ? { locationId: query.locationId } : {}),
    ...(query.over90Only ? { over90Only: 1 } : {}),
    ...(query.missingPhotosOnly ? { missingPhotosOnly: 1 } : {}),
    ...(query.floorPlannedOnly ? { floorPlannedOnly: 1 } : {}),
  };

  const savedView = await getInventoryListViewPreference({ dealershipId, userId });
  const initialViewMode = savedView === "cards" ? "cards" : "table";

  return (
    <InventoryListContent
      initialData={initialData}
      currentQuery={currentQuery}
      canWrite={canWrite}
      initialViewMode={initialViewMode}
    />
  );
}
