import { unstable_noStore as noStore } from "next/cache";
import { getSessionContextOrNull } from "@/lib/api/handler";
import * as appraisalService from "@/modules/inventory/service/appraisal";
import { PageShell } from "@/components/ui/page-shell";
import { AppraisalsPageClient } from "./AppraisalsPageClient";

export const dynamic = "force-dynamic";

export type AppraisalRow = {
  id: string;
  vin: string;
  sourceType: string;
  vehicleId: string | null;
  appraisedBy: { id: string; fullName: string | null } | null;
  acquisitionCostCents: string;
  reconEstimateCents: string;
  transportEstimateCents: string;
  feesEstimateCents: string;
  expectedRetailCents: string;
  expectedWholesaleCents: string;
  expectedTradeInCents: string;
  expectedProfitCents: string;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  vehicle: { id: string; stockNumber: string; vin: string | null } | null;
};

function serializeAppraisal(
  row: Awaited<ReturnType<typeof appraisalService.listAppraisals>>["data"][number]
): AppraisalRow {
  return {
    id: row.id,
    vin: row.vin,
    sourceType: row.sourceType,
    vehicleId: row.vehicleId,
    appraisedBy: row.appraisedBy,
    acquisitionCostCents: row.acquisitionCostCents.toString(),
    reconEstimateCents: row.reconEstimateCents.toString(),
    transportEstimateCents: row.transportEstimateCents.toString(),
    feesEstimateCents: row.feesEstimateCents.toString(),
    expectedRetailCents: row.expectedRetailCents.toString(),
    expectedWholesaleCents: row.expectedWholesaleCents.toString(),
    expectedTradeInCents: row.expectedTradeInCents.toString(),
    expectedProfitCents: row.expectedProfitCents.toString(),
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    vehicle: row.vehicle,
  };
}

export default async function AppraisalsRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  noStore();
  const session = await getSessionContextOrNull();
  const dealershipId = session?.activeDealershipId ?? null;
  const permissions = session?.permissions ?? [];
  const canRead = permissions.includes("inventory.appraisals.read");
  const canWrite = permissions.includes("inventory.appraisals.write");

  if (!canRead || !dealershipId) {
    return (
      <PageShell>
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]">
          <p className="text-[var(--muted-text)]">You don&apos;t have access to appraisals.</p>
        </div>
      </PageShell>
    );
  }

  const raw = await searchParams;
  const single = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v[0] : v;
  const search = single(raw.search);
  const sourceType = single(raw.sourceType) as "TRADE_IN" | "AUCTION" | "MARKETPLACE" | "STREET" | undefined;
  const status = single(raw.status) as "DRAFT" | "APPROVED" | "REJECTED" | "PURCHASED" | "CONVERTED" | undefined;
  const limit = Math.min(parseInt(single(raw.limit) ?? "25", 10) || 25, 100);
  const offset = Math.max(0, parseInt(single(raw.offset) ?? "0", 10) || 0);

  const { data, total } = await appraisalService.listAppraisals(dealershipId, {
    limit,
    offset,
    filters: { status, sourceType, vin: search },
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  const initialData = {
    data: data.map(serializeAppraisal),
    total,
    limit,
    offset,
  };
  const currentQuery = { search: search ?? "", sourceType: sourceType ?? "", status: status ?? "" };

  return (
    <PageShell
      fullWidth
      contentClassName="px-4 sm:px-6 lg:px-8 min-[1800px]:px-10 min-[2200px]:px-14"
    >
      <AppraisalsPageClient
        initialData={initialData}
        currentQuery={currentQuery}
        canWrite={canWrite}
      />
    </PageShell>
  );
}
