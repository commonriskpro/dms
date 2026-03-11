/**
 * Centralized dealer tenant lifecycle enforcement (SUSPENDED/CLOSED).
 * Non-bypassable: call from service layer for all tenant-scoped operations.
 *
 * Write guard (requireTenantActiveForWrite) is used in:
 * - deals, inventory, documents, customers (task, note, activity, customer),
 * - crm-pipeline-automation (stage, sequence, pipeline, opportunity, automation-rule, stage-transition, automation-engine, journey-bar read-only),
 * - core-platform (file, role, membership, dealership),
 * - lender-integration (lender, application, submission, stipulation),
 * - finance-shell (putFinance, patchFinanceStatus, addProduct, updateProduct, deleteProduct),
 * - platform-admin invite (createInvite, acceptInvite, cancelInvite, resendInvite).
 * Read guard (requireTenantActiveForRead) is used in the same modules for list/get operations.
 */

import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth";

type TenantAccessMode = "read" | "write";

/**
 * Ensures tenant is allowed for the given mode.
 * - ACTIVE: allowed for read and write.
 * - SUSPENDED: read allowed; write throws TENANT_SUSPENDED (403).
 * - CLOSED: read and write throw TENANT_CLOSED (403).
 */
async function requireTenantStatus(
  dealershipId: string,
  mode: TenantAccessMode
): Promise<void> {
  const dealership = await prisma.dealership.findUnique({
    where: { id: dealershipId },
    select: { lifecycleStatus: true },
  });
  if (!dealership) {
    throw new ApiError("NOT_FOUND", "Dealership not found");
  }
  const status = dealership.lifecycleStatus;
  if (status === "CLOSED") {
    throw new ApiError("TENANT_CLOSED", "This dealership is closed");
  }
  if (status === "SUSPENDED" && mode === "write") {
    throw new ApiError("TENANT_SUSPENDED", "This dealership is suspended; writes are not allowed");
  }
}

/** Convenience: allow read only if tenant is not CLOSED. */
export async function requireTenantActiveForRead(dealershipId: string): Promise<void> {
  return requireTenantStatus(dealershipId, "read");
}

/** Convenience: allow write only if tenant is ACTIVE. */
export async function requireTenantActiveForWrite(dealershipId: string): Promise<void> {
  return requireTenantStatus(dealershipId, "write");
}

/**
 * Returns lifecycle status for the dealership, or null if not found.
 * Use when you need to branch (e.g. job worker skip) without throwing.
 */
export async function getDealershipLifecycleStatus(
  dealershipId: string
): Promise<"ACTIVE" | "SUSPENDED" | "CLOSED" | null> {
  const d = await prisma.dealership.findUnique({
    where: { id: dealershipId },
    select: { lifecycleStatus: true },
  });
  return d?.lifecycleStatus ?? null;
}
