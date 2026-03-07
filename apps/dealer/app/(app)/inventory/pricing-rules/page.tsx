import { unstable_noStore as noStore } from "next/cache";
import { getSessionContextOrNull } from "@/lib/api/handler";
import { PageShell } from "@/components/ui/page-shell";
import { PricingRulesPageClient } from "./PricingRulesPageClient";

export const dynamic = "force-dynamic";

export default async function PricingRulesRoute() {
  noStore();
  const session = await getSessionContextOrNull();
  const permissions = session?.permissions ?? [];
  const canRead = permissions.includes("inventory.pricing.read");
  const canWrite = permissions.includes("inventory.pricing.write");

  if (!canRead) {
    return (
      <PageShell>
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]">
          <p className="text-[var(--muted-text)]">You don&apos;t have access to pricing rules.</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PricingRulesPageClient canWrite={canWrite} />
    </PageShell>
  );
}
