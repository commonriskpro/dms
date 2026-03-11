import { unstable_noStore as noStore } from "next/cache";
import { getSessionContextOrNull } from "@/lib/api/handler";
import * as acquisitionService from "@/modules/inventory/service/acquisition";
import { PageShell } from "@/components/ui/page-shell";
import { AcquisitionPageClient } from "./AcquisitionPageClient";

export const dynamic = "force-dynamic";

const STAGES = ["NEW", "CONTACTED", "NEGOTIATING", "WON", "LOST"] as const;

export type AcquisitionLeadRow = {
  id: string;
  vin: string;
  sourceType: string;
  sellerName: string | null;
  sellerPhone: string | null;
  sellerEmail: string | null;
  askingPriceCents: string | null;
  negotiatedPriceCents: string | null;
  status: string;
  appraisalId: string | null;
  appraisal: {
    id: string;
    vin: string;
    status: string;
    expectedRetailCents: string;
    expectedProfitCents: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

function serializeLead(
  row: Awaited<ReturnType<typeof acquisitionService.listInventorySourceLeads>>["data"][number]
): AcquisitionLeadRow {
  return {
    id: row.id,
    vin: row.vin,
    sourceType: row.sourceType,
    sellerName: row.sellerName,
    sellerPhone: row.sellerPhone,
    sellerEmail: row.sellerEmail,
    askingPriceCents: row.askingPriceCents?.toString() ?? null,
    negotiatedPriceCents: row.negotiatedPriceCents?.toString() ?? null,
    status: row.status,
    appraisalId: row.appraisalId,
    appraisal: row.appraisal
      ? {
          id: row.appraisal.id,
          vin: row.appraisal.vin,
          status: row.appraisal.status,
          expectedRetailCents: row.appraisal.expectedRetailCents.toString(),
          expectedProfitCents: row.appraisal.expectedProfitCents.toString(),
        }
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export default async function AcquisitionRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  noStore();
  const session = await getSessionContextOrNull();
  const dealershipId = session?.activeDealershipId ?? null;
  const permissions = session?.permissions ?? [];
  const canRead = permissions.includes("inventory.acquisition.read");
  const canWrite = permissions.includes("inventory.acquisition.write");

  if (!canRead || !dealershipId) {
    return (
      <PageShell>
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]">
          <p className="text-[var(--muted-text)]">You don&apos;t have access to acquisition.</p>
        </div>
      </PageShell>
    );
  }

  const raw = await searchParams;
  const single = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v[0] : v;
  const search = single(raw.search);
  const sourceType = single(raw.sourceType);

  const { data } = await acquisitionService.listInventorySourceLeads(dealershipId, {
    limit: 500,
    offset: 0,
    filters: {
      vin: search || undefined,
      sourceType: sourceType as "AUCTION" | "TRADE_IN" | "MARKETPLACE" | "STREET" | undefined,
    },
    sortBy: "updatedAt",
    sortOrder: "desc",
  });

  const leads = data.map(serializeLead);
  const byStage: Record<string, AcquisitionLeadRow[]> = {};
  for (const s of STAGES) byStage[s] = [];
  for (const lead of leads) {
    if (byStage[lead.status]) byStage[lead.status].push(lead);
  }

  return (
    <PageShell
      fullWidth
      contentClassName="px-4 sm:px-6 lg:px-8 min-[1800px]:px-10 min-[2200px]:px-14"
    >
      <AcquisitionPageClient
        initialStages={byStage}
        currentQuery={{ search: search ?? "", sourceType: sourceType ?? "" }}
        canWrite={canWrite}
      />
    </PageShell>
  );
}
