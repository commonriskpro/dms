"use client";

import { useRouter } from "next/navigation";
import { useSession } from "@/contexts/session-context";
import { ModalShell } from "@/components/modal/ModalShell";
import { CustomerDetailContent } from "@/modules/customers/ui/CustomerDetailContent";
import type { CustomerDetail, TimelineListResponse, CallbacksListResponse } from "@/lib/types/customers";

export type CustomerDetailModalClientProps = {
  customerId: string;
  initialData: CustomerDetail | null;
  initialTimeline?: TimelineListResponse | null;
  initialCallbacks?: CallbacksListResponse | null;
  errorKind?: "forbidden" | "not_found" | "invalid_id" | null;
};

/**
 * Client wrapper for customer detail modal. Uses server-loaded initialData only; no fetch-on-mount.
 * Modal error pages: pass only error to ModalShell and omit children (per §7 ModalShell pattern).
 */
export function CustomerDetailModalClient({
  customerId,
  initialData,
  initialTimeline = null,
  initialCallbacks = null,
  errorKind = null,
}: CustomerDetailModalClientProps) {
  const router = useRouter();
  const { hasPermission } = useSession();
  const canWrite = hasPermission("customers.write");
  const canRead = hasPermission("customers.read");
  const canReadDeals = hasPermission("deals.read");
  const canReadCrm = hasPermission("crm.read");

  const titleText = initialData?.name ?? "Customer";

  if (errorKind === "forbidden") {
    return (
      <ModalShell
        title="Customer"
        error={{
          title: "Access denied",
          message: "You don't have permission to view this customer.",
        }}
      />
    );
  }

  if (errorKind === "not_found" || errorKind === "invalid_id") {
    return (
      <ModalShell
        title="Customer"
        error={{
          title: "Customer not found",
          message:
            errorKind === "invalid_id" ? "Invalid customer ID." : "It may have been deleted.",
          onRetry: () => router.push("/customers"),
        }}
      />
    );
  }

  if (!initialData) {
    return <ModalShell title="Customer" loading />;
  }

  return (
    <ModalShell title={titleText}>
      <CustomerDetailContent
        customer={initialData}
        customerId={customerId}
        mode="modal"
        canRead={canRead}
        canWrite={canWrite}
        canReadDeals={canReadDeals}
        canReadCrm={canReadCrm}
        initialTimeline={initialTimeline ?? undefined}
        initialCallbacks={initialCallbacks ?? undefined}
      />
    </ModalShell>
  );
}
