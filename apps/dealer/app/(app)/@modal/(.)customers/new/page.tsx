"use client";

import { ModalShell } from "@/components/modal/ModalShell";
import { CreateCustomerPage } from "@/modules/customers/ui/CreateCustomerPage";

export default function CustomersNewModalPage() {
  return (
    <ModalShell title="New customer">
      <CreateCustomerPage />
    </ModalShell>
  );
}
