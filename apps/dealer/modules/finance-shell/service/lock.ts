import * as financeDb from "../db";
import { auditLog } from "@/lib/audit";

/** Called when Deal.status becomes CONTRACTED: lock finance and set status. */
export async function lockFinanceWhenDealContracted(
  dealershipId: string,
  dealId: string,
  meta?: { ip?: string; userAgent?: string }
): Promise<void> {
  const finance = await financeDb.getFinanceByDealId(dealId, dealershipId);
  if (!finance) return;
  if (finance.status === "CONTRACTED") return;
  await financeDb.updateFinanceStatus(dealershipId, finance.id, "CONTRACTED");
  await auditLog({
    dealershipId,
    actorUserId: null,
    action: "finance.locked",
    entity: "DealFinance",
    entityId: finance.id,
    metadata: { dealId, dealFinanceId: finance.id },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
}
