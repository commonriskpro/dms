"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client/http";
import { getApiErrorMessage } from "@/lib/client/http";
import { useSession } from "@/contexts/session-context";
import { useToast } from "@/components/toast";
import { useWriteDisabled } from "@/components/write-guard";
import { CustomerForm } from "./CustomerForm";
import type {
  CustomerDetail,
  CustomerStatus,
  CustomerPhoneInput,
  CustomerEmailInput,
} from "@/lib/types/customers";

type MemberOption = { id: string; fullName: string | null; email: string };

export function CreateCustomerPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const { hasPermission } = useSession();
  const { disabled: writeDisabled } = useWriteDisabled();
  const canWrite = hasPermission("customers.write");

  const [assignedOptions, setAssignedOptions] = React.useState<{ value: string; label: string }[]>([]);
  const [submitLoading, setSubmitLoading] = React.useState(false);

  React.useEffect(() => {
    if (!hasPermission("admin.memberships.read")) return;
    apiFetch<{ data: { user: MemberOption }[] }>("/api/admin/memberships?limit=100")
      .then((res) => {
        const seen = new Set<string>();
        const list: { value: string; label: string }[] = [];
        for (const m of res.data ?? []) {
          const u = m.user;
          if (u && !seen.has(u.id)) {
            seen.add(u.id);
            list.push({
              value: u.id,
              label: u.fullName ?? u.email ?? u.id,
            });
          }
        }
        setAssignedOptions(list);
      })
      .catch(() => setAssignedOptions([]));
  }, [hasPermission]);

  const handleSubmit = React.useCallback(
    async (body: {
      name: string;
      status: CustomerStatus;
      leadSource?: string;
      assignedTo?: string;
      tags?: string[];
      addressLine1?: string;
      addressLine2?: string;
      city?: string;
      region?: string;
      postalCode?: string;
      country?: string;
      phones?: CustomerPhoneInput[];
      emails?: CustomerEmailInput[];
    }) => {
      if (!canWrite) return;
      setSubmitLoading(true);
      try {
        const res = await apiFetch<{ data: CustomerDetail }>("/api/customers", {
          method: "POST",
          body: JSON.stringify(body),
        });
        addToast("success", "Customer created");
        router.push(`/customers/${res.data.id}`);
      } catch (e) {
        addToast("error", getApiErrorMessage(e));
        throw e;
      } finally {
        setSubmitLoading(false);
      }
    },
    [canWrite, router, addToast]
  );

  if (!canWrite) {
    return (
      <div className="space-y-6">
        <Link href="/customers" className="text-sm text-[var(--accent)] hover:underline">
          ← Back to customers
        </Link>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-6">
          <p className="text-[var(--text-soft)]">You don’t have permission to create customers.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/customers" className="text-sm text-[var(--accent)] hover:underline">
          ← Back to customers
        </Link>
      </div>
      <h1 className="text-2xl font-semibold text-[var(--text)]">New customer</h1>
      <CustomerForm
        assignedOptions={assignedOptions}
        onSubmit={handleSubmit}
        submitLabel="Create customer"
        isLoading={submitLoading}
        submitDisabled={writeDisabled}
      />
    </div>
  );
}
