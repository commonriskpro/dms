"use client";

import { ModalShell } from "@/components/modal/ModalShell";
import { CreateDealPage } from "@/modules/deals/ui/CreateDealPage";

export default function DealsNewModalPage() {
  return (
    <ModalShell title="New deal">
      <CreateDealPage />
    </ModalShell>
  );
}
