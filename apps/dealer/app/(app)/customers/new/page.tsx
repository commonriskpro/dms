import { Suspense } from "react";
import { CreateCustomerPage } from "@/modules/customers/ui/CreateCustomerPage";

export default function NewCustomerPage() {
  return (
    <Suspense fallback={null}>
      <CreateCustomerPage />
    </Suspense>
  );
}
