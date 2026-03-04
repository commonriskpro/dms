import * as auditDb from "../db/audit";
import { requireTenantActiveForRead } from "@/lib/tenant-status";

export async function listAuditLogs(
  dealershipId: string,
  limit: number,
  offset: number,
  filters?: auditDb.AuditFilters
) {
  await requireTenantActiveForRead(dealershipId);
  return auditDb.listAuditLogs(dealershipId, limit, offset, filters);
}
