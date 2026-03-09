import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { z } from "zod";

export const dynamic = "force-dynamic";

import { getSessionContextOrNull } from "@/lib/api/handler";
import * as dealDeskService from "@/modules/deals/service/deal-desk";
import { DealDeskWorkspace } from "@/modules/deals/ui/desk/DealDeskWorkspace";
import { ApiError } from "@/lib/auth";

const idSchema = z.string().uuid();

/**
 * Deal Desk: server-first load via getDealDeskData, then render DealDeskWorkspace.
 */
export default async function DealDeskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  noStore();
  const { id } = await params;

  const session = await getSessionContextOrNull();
  const dealershipId = session?.activeDealershipId ?? null;
  const hasRead = Boolean(dealershipId && session?.permissions?.includes("deals.read"));

  const uuidResult = idSchema.safeParse(id);
  if (!uuidResult.success || !hasRead || !dealershipId) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-[var(--text)]">
        <p className="text-[var(--muted-text)]">Deal not found or you don’t have access.</p>
        <Link href="/deals" className="text-[var(--ring)] underline">
          Back to deals
        </Link>
      </div>
    );
  }

  let deskData: Awaited<ReturnType<typeof dealDeskService.getDealDeskData>> | null = null;

  try {
    deskData = await dealDeskService.getDealDeskData(dealershipId, id);
  } catch (e) {
    if (e instanceof ApiError && e.code === "NOT_FOUND") {
      deskData = null;
    } else {
      throw e;
    }
  }

  if (!deskData) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-[var(--text)]">
        <p className="text-[var(--muted-text)]">Deal not found.</p>
        <Link href="/deals" className="text-[var(--ring)] underline">
          Back to deals
        </Link>
      </div>
    );
  }

  return <DealDeskWorkspace id={id} initialData={deskData} />;
}
