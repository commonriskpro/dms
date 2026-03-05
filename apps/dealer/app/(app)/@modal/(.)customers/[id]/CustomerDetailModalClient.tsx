"use client";

import { useRouter } from "next/navigation";
import { useSession } from "@/contexts/session-context";
import { ModalShell } from "@/components/modal/ModalShell";
import { ModalErrorBody } from "@/components/ui/modal-error-body";
import { CustomerDetailContent } from "@/modules/customers/ui/CustomerDetailContent";
import type { CustomerDetail } from "@/lib/types/customers";

export type CustomerDetailModalClientProps = {
  customerId: string;
  initialData: CustomerDetail | null;
  errorKind?: "forbidden" | "not_found" | "invalid_id" | null;
};

/**
 * Client wrapper for customer detail modal. Uses server-loaded initialData only; no fetch-on-mount.
 */
export function CustomerDetailModalClient({
  customerId,
  initialData,
  errorKind = null,
}: CustomerDetailModalClientProps) {
  const router = useRouter();
  const { hasPermission } = useSession();
  const canWrite = hasPermission("customers.write");
  const canRead = hasPermission("customers.read");

  const titleText = initialData?.name ?? "Customer";

  if (errorKind === "forbidden") {
    return (
      <ModalShell
        title="Customer"
        error={{
          title: "Access denied",
          message: "You don't have permission to view this customer.",
        }}
      >
        <ModalErrorBody />
      </ModalShell>
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
      >
        <ModalErrorBody hint="Go back to the customer list to try again." />
      </ModalShell>
    );
  }

  if (!initialData) {
    return (
      <ModalShell title="Customer" loading>
        <ModalErrorBody />
      </ModalShell>
    );
  }

  return (
    <ModalShell title={titleText}>
      <CustomerDetailContent
        customer={initialData}
        customerId={customerId}
        mode="modal"
        canRead={canRead}
        canWrite={canWrite}
      />
    </ModalShell>
  );
}
