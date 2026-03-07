import { unstable_noStore as noStore } from "next/cache";
import { getSessionContextOrNull } from "@/lib/api/handler";
import { PageShell } from "@/components/ui/page-shell";
import { AuctionsPageClient } from "./AuctionsPageClient";

export const dynamic = "force-dynamic";

/**
 * Auctions page: server-first. Initial load has no search, so we pass empty results.
 * Client submits search (MOCK provider) and displays results; no refetch on mount.
 */
export default async function AuctionsRoute() {
  noStore();
  const session = await getSessionContextOrNull();
  const permissions = session?.permissions ?? [];
  const canRead = permissions.includes("inventory.auctions.read");
  const canWriteAppraisal = permissions.includes("inventory.appraisals.write");

  if (!canRead) {
    return (
      <PageShell>
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]">
          <p className="text-[var(--muted-text)]">You don&apos;t have access to auctions.</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <AuctionsPageClient canCreateAppraisal={canWriteAppraisal} />
    </PageShell>
  );
}
