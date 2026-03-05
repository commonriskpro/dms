"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { AppModal } from "@/components/ui/app-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { CustomerDetailContent } from "@/modules/customers/ui/CustomerDetailContent";
import { mainGrid } from "@/lib/ui/recipes/layout";
import type { CustomerDetail } from "@/lib/types/customers";

export type CustomerDetailModalProps = {
  customerId: string;
};

export function CustomerDetailModal({ customerId }: CustomerDetailModalProps) {
  const router = useRouter();
  const { hasPermission } = useSession();
  const canRead = hasPermission("customers.read");
  const canWrite = hasPermission("customers.write");

  const [customer, setCustomer] = React.useState<CustomerDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [notFound, setNotFound] = React.useState(false);

  const fetchCustomer = React.useCallback(async () => {
    if (!canRead) return;
    try {
      const res = await apiFetch<{ data: CustomerDetail }>(`/api/customers/${customerId}`);
      setCustomer(res.data);
      setError(null);
      setNotFound(false);
    } catch (e: unknown) {
      const status = e && typeof e === "object" && "status" in e ? (e as { status: number }).status : 0;
      if (status === 404) {
        setNotFound(true);
        setCustomer(null);
      } else {
        setError(e instanceof Error ? e.message : "Failed to load customer");
      }
    } finally {
      setLoading(false);
    }
  }, [customerId, canRead]);

  React.useEffect(() => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchCustomer();
  }, [canRead, customerId, fetchCustomer]);

  const handleRequestClose = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/customers");
    }
  };

  const titleText = customer ? customer.name : "Customer";

  const body = !canRead ? (
    <p className="text-sm text-[var(--muted-text)]">You don&apos;t have access to customers.</p>
  ) : loading ? (
    <div className={mainGrid}>
      <Skeleton className="h-64" />
      <Skeleton className="h-48" />
    </div>
  ) : notFound ? (
    <ErrorState
      title="Customer not found"
      message="It may have been deleted."
      onRetry={() => router.push("/customers")}
    />
  ) : error || !customer ? (
    <ErrorState message={error ?? "Customer not found"} onRetry={fetchCustomer} />
  ) : (
    <CustomerDetailContent
      customer={customer}
      customerId={customerId}
      mode="modal"
      canRead={canRead}
      canWrite={canWrite}
    />
  );

  return (
    <AppModal
      open
      onOpenChange={() => {}}
      title={titleText}
      closeBehavior="back"
      onRequestClose={handleRequestClose}
      size="xl"
    >
      {body}
    </AppModal>
  );
}
