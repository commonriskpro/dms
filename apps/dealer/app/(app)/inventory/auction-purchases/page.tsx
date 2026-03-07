import { unstable_noStore as noStore } from "next/cache";
import { getSessionContextOrNull } from "@/lib/api/handler";
import * as auctionPurchaseService from "@/modules/inventory/service/auction-purchase";
import { PageShell } from "@/components/ui/page-shell";
import { AuctionPurchasesPageClient } from "./AuctionPurchasesPageClient";

export const dynamic = "force-dynamic";

export type AuctionPurchaseRow = {
  id: string;
  vehicleId: string | null;
  vehicle: { id: string; stockNumber: string; vin: string | null; year: number | null; make: string | null; model: string | null } | null;
  auctionName: string;
  lotNumber: string;
  purchasePriceCents: string;
  feesCents: string;
  shippingCents: string;
  etaDate: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

function serialize(row: Awaited<ReturnType<typeof auctionPurchaseService.listAuctionPurchases>>["data"][number]): AuctionPurchaseRow {
  return {
    id: row.id,
    vehicleId: row.vehicleId,
    vehicle: row.vehicle,
    auctionName: row.auctionName,
    lotNumber: row.lotNumber,
    purchasePriceCents: row.purchasePriceCents.toString(),
    feesCents: row.feesCents.toString(),
    shippingCents: row.shippingCents.toString(),
    etaDate: row.etaDate?.toISOString() ?? null,
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export default async function AuctionPurchasesRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  noStore();
  const session = await getSessionContextOrNull();
  const dealershipId = session?.activeDealershipId ?? null;
  const permissions = session?.permissions ?? [];
  const canRead = permissions.includes("inventory.read");
  const canWrite = permissions.includes("inventory.write");

  if (!canRead || !dealershipId) {
    return (
      <PageShell>
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]">
          <p className="text-[var(--muted-text)]">You don&apos;t have access to auction purchases.</p>
        </div>
      </PageShell>
    );
  }

  const raw = await searchParams;
  const single = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v[0] : v;
  const limit = Math.min(parseInt(single(raw.limit) ?? "25", 10) || 25, 100);
  const offset = Math.max(0, parseInt(single(raw.offset) ?? "0", 10) || 0);
  const status = single(raw.status) as "PENDING" | "IN_TRANSIT" | "RECEIVED" | "CANCELLED" | undefined;

  const { data, total } = await auctionPurchaseService.listAuctionPurchases(dealershipId, {
    limit,
    offset,
    filters: { status },
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  const initialData = {
    data: data.map(serialize),
    total,
    limit,
    offset,
  };

  return (
    <PageShell>
      <AuctionPurchasesPageClient
        initialData={initialData}
        currentQuery={{ status: status ?? "" }}
        canWrite={canWrite}
      />
    </PageShell>
  );
}
