import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { getSessionContextOrNull } from "@/lib/api/handler";
import { isApiError } from "@/lib/api/errors";
import {
  getInventoryIntelligenceDashboard,
  inventoryDashboardQuerySchema,
} from "@/modules/inventory/service/inventory-intelligence-dashboard";
import { InventoryDashboardContent } from "./InventoryDashboardContent";
import { PageShell } from "@/components/ui/page-shell";

export const dynamic = "force-dynamic";

function InvalidQueryUI() {
  return (
    <PageShell>
      <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]">
        <p className="text-[var(--muted-text)]">Invalid filters. Please adjust and try again.</p>
        <Link
          href="/inventory/dashboard"
          className="mt-2 inline-block text-sm text-[var(--accent)] hover:underline"
        >
          Clear and reload
        </Link>
      </div>
    </PageShell>
  );
}

export default async function InventoryDashboardRoute({
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
          <p className="text-[var(--muted-text)]">
            You don&apos;t have access to inventory.
          </p>
        </div>
      </PageShell>
    );
  }

  const raw = await searchParams;
  const single = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v[0] : v;
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
  if (single(raw.alertType) !== undefined) rawQuery.alertType = single(raw.alertType);
  if (single(raw.floorplanOverdue) !== undefined)
    rawQuery.floorplanOverdue = single(raw.floorplanOverdue);

  const parsed = inventoryDashboardQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    return <InvalidQueryUI />;
  }
  const query = parsed.data;

  let data: Awaited<ReturnType<typeof getInventoryIntelligenceDashboard>>;
  try {
    data = await getInventoryIntelligenceDashboard(
      { dealershipId, userId, permissions },
      rawQuery
    );
  } catch (e) {
    if (isApiError(e) && e.code === "INVALID_QUERY") {
      return <InvalidQueryUI />;
    }
    throw e;
  }
  // Server component: single run per request; no client re-renders
  // eslint-disable-next-line react-hooks/purity -- RSC
  const lastUpdatedMs = Date.now();

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
  if (query.alertType) currentQuery.alertType = query.alertType;
  if (query.floorplanOverdue != null)
    currentQuery.floorplanOverdue = query.floorplanOverdue;

  return (
    <InventoryDashboardContent
      data={data}
      currentQuery={currentQuery}
      canWrite={canWrite}
      lastUpdatedMs={lastUpdatedMs}
    />
  );
}
