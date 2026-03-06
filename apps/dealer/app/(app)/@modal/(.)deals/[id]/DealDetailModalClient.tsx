"use client";

import { useRouter } from "next/navigation";
import { ModalShell } from "@/components/modal/ModalShell";
import { DealDetailPage } from "@/modules/deals/ui/DetailPage";
import type { DealDetail } from "@/modules/deals/ui/types";

export type DealDetailModalClientProps = {
  dealId: string;
  initialData: DealDetail | null;
  errorKind?: "forbidden" | "not_found" | "invalid_id" | null;
};

/**
 * Client wrapper for deal detail modal. Uses server-loaded initialData; no fetch-on-mount.
 * Modal error pages: pass only error to ModalShell and omit children (per §7 ModalShell pattern).
 */
export function DealDetailModalClient({
  dealId,
  initialData,
  errorKind = null,
}: DealDetailModalClientProps) {
  const router = useRouter();
  const titleText = initialData ? `Deal ${initialData.id.slice(0, 8)}…` : "Deal";

  if (errorKind === "forbidden") {
    return (
      <ModalShell
        title="Deal"
        error={{
          title: "Access denied",
          message: "You don't have access to deals.",
        }}
      />
    );
  }

  if (errorKind === "not_found" || errorKind === "invalid_id") {
    return (
      <ModalShell
        title="Deal"
        error={{
          title: "Deal not found",
          message:
            errorKind === "invalid_id" ? "Invalid deal ID." : "It may have been deleted.",
          onRetry: () => router.push("/deals"),
        }}
      />
    );
  }

  if (!initialData) {
    return <ModalShell title="Deal" loading />;
  }

  return (
    <ModalShell title={titleText} size="xl">
      <DealDetailPage id={dealId} initialData={initialData} />
    </ModalShell>
  );
}
