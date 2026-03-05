import { unstable_noStore as noStore } from "next/cache";
import { z } from "zod";

export const dynamic = "force-dynamic";
import { getSessionContextOrNull } from "@/lib/api/handler";
import * as customerService from "@/modules/customers/service/customer";
import { CustomerDetailModalClient } from "./CustomerDetailModalClient";
import type { CustomerDetail } from "@/lib/types/customers";
import { ApiError } from "@/lib/auth";

const idSchema = z.string().uuid();

function toCustomerDetail(c: Awaited<ReturnType<typeof customerService.getCustomer>>): CustomerDetail {
  return {
    id: c.id,
    dealershipId: c.dealershipId,
    name: c.name,
    leadSource: c.leadSource,
    status: c.status,
    assignedTo: c.assignedTo,
    addressLine1: c.addressLine1,
    addressLine2: c.addressLine2,
    city: c.city,
    region: c.region,
    postalCode: c.postalCode,
    country: c.country,
    tags: c.tags,
    createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : (c.createdAt as string),
    updatedAt: c.updatedAt instanceof Date ? c.updatedAt.toISOString() : (c.updatedAt as string),
    phones: c.phones,
    emails: c.emails,
    assignedToProfile: c.assignedToProfile,
  };
}

export default async function CustomerDetailModalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  noStore();
  const { id } = await params;

  const session = await getSessionContextOrNull();
  const dealershipId = session?.activeDealershipId ?? null;
  const hasRead = Boolean(dealershipId && session?.permissions?.includes("customers.read"));

  const uuidResult = idSchema.safeParse(id);
  if (!uuidResult.success) {
    return (
      <CustomerDetailModalClient
        customerId={id}
        initialData={null}
        errorKind="invalid_id"
      />
    );
  }

  if (!hasRead || !dealershipId) {
    return (
      <CustomerDetailModalClient
        customerId={id}
        initialData={null}
        errorKind="forbidden"
      />
    );
  }

  let initialData: CustomerDetail | null = null;
  let errorKind: "not_found" | null = null;

  try {
    const customer = await customerService.getCustomer(dealershipId, id);
    initialData = toCustomerDetail(customer);
  } catch (e) {
    if (e instanceof ApiError && e.code === "NOT_FOUND") {
      errorKind = "not_found";
    } else {
      throw e;
    }
  }

  return (
    <CustomerDetailModalClient
      customerId={id}
      initialData={initialData}
      errorKind={errorKind ?? undefined}
    />
  );
}
