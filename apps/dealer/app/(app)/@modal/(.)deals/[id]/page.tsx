import { unstable_noStore as noStore } from "next/cache";
import { z } from "zod";

export const dynamic = "force-dynamic";
import { getSessionContextOrNull } from "@/lib/api/handler";
import * as dealService from "@/modules/deals/service/deal";
import { toDealDetail } from "@/app/api/deals/serialize";
import { DealDetailModalClient } from "./DealDetailModalClient";
import type { DealDetail } from "@/modules/deals/ui/types";
import { ApiError } from "@/lib/auth";

const idSchema = z.string().uuid();

export default async function DealDetailModalPage({
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
  if (!uuidResult.success) {
    return (
      <DealDetailModalClient dealId={id} initialData={null} errorKind="invalid_id" />
    );
  }

  if (!hasRead || !dealershipId) {
    return (
      <DealDetailModalClient dealId={id} initialData={null} errorKind="forbidden" />
    );
  }

  let initialData: DealDetail | null = null;
  let errorKind: "not_found" | null = null;

  try {
    const deal = await dealService.getDeal(dealershipId, id);
    initialData = toDealDetail(deal);
  } catch (e) {
    if (e instanceof ApiError && e.code === "NOT_FOUND") {
      errorKind = "not_found";
    } else {
      throw e;
    }
  }

  return (
    <DealDetailModalClient
      dealId={id}
      initialData={initialData}
      errorKind={errorKind ?? undefined}
    />
  );
}
