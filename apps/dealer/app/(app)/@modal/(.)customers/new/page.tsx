"use client";

"use client";

import { Suspense } from "react";
import { ModalShell } from "@/components/modal/ModalShell";
import { CreateCustomerPage } from "@/modules/customers/ui/CreateCustomerPage";

export default function CustomersNewModalPage() {
  return (
    <ModalShell title="New customer" size="4xl" hideHeader flushBody>
      <Suspense fallback={null}>
        <CreateCustomerPage mode="modal" />
      </Suspense>
    </ModalShell>
  );
}
