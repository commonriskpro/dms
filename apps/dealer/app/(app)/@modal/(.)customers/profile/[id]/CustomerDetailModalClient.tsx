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
          message: errorKind === "invalid_id" ? "Invalid customer ID." : "It may have been deleted.",
          onRetry: () => router.push("/customers"),
        }}
      />
    );
  }

  if (!initialData) {
    return <ModalShell title="Customer" loading />;
  }

  return (
    <ModalShell title={initialData.name} size="4xl" hideHeader flushBody>
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
