import * as creditApplicationDb from "../db/credit-application";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import { encryptField } from "@/lib/field-encryption";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";
import * as dealService from "@/modules/deals/service/deal";
import * as customerService from "@/modules/customers/service/customer";
import { toBigIntOrNull } from "@/lib/bigint";

export async function getCreditApplication(
  dealershipId: string,
  id: string
) {
  await requireTenantActiveForRead(dealershipId);
  const app = await creditApplicationDb.getCreditApplicationById(dealershipId, id);
  if (!app) throw new ApiError("NOT_FOUND", "Credit application not found");
  return app;
}

export async function listCreditApplications(
  dealershipId: string,
  options: creditApplicationDb.ListCreditApplicationsOptions
) {
  await requireTenantActiveForRead(dealershipId);
  return creditApplicationDb.listCreditApplications(dealershipId, options);
}

export async function createCreditApplication(
  dealershipId: string,
  userId: string,
  data: {
    dealId?: string | null;
    customerId: string;
    applicantFirstName: string;
    applicantLastName: string;
    dob?: string | null;
    ssn?: string;
    phone?: string | null;
    email?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    housingStatus?: string | null;
    housingPaymentCents?: string | null;
    yearsAtResidence?: number | null;
    employerName?: string | null;
    jobTitle?: string | null;
    employmentYears?: number | null;
    monthlyIncomeCents?: string | null;
    otherIncomeCents?: string | null;
    notes?: string | null;
  },
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  if (data.dealId) {
    await dealService.getDeal(dealershipId, data.dealId);
  }
  await customerService.getCustomer(dealershipId, data.customerId);

  const ssnEncrypted = data.ssn
    ? encryptField(data.ssn)
    : null;

  const created = await creditApplicationDb.createCreditApplication({
    dealershipId,
    dealId: data.dealId ?? null,
    customerId: data.customerId,
    status: "DRAFT",
    applicantFirstName: data.applicantFirstName,
    applicantLastName: data.applicantLastName,
    dob: data.dob ? new Date(data.dob) : null,
    ssnEncrypted,
    phone: data.phone ?? null,
    email: data.email ?? null,
    addressLine1: data.addressLine1 ?? null,
    addressLine2: data.addressLine2 ?? null,
    city: data.city ?? null,
    state: data.state ?? null,
    postalCode: data.postalCode ?? null,
    housingStatus: data.housingStatus ?? null,
    housingPaymentCents: toBigIntOrNull(data.housingPaymentCents),
    yearsAtResidence: data.yearsAtResidence ?? null,
    employerName: data.employerName ?? null,
    jobTitle: data.jobTitle ?? null,
    employmentYears: data.employmentYears ?? null,
    monthlyIncomeCents: toBigIntOrNull(data.monthlyIncomeCents),
    otherIncomeCents: toBigIntOrNull(data.otherIncomeCents),
    notes: data.notes ?? null,
    createdByUserId: userId,
  });

  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "credit_application.created",
    entity: "CreditApplication",
    entityId: created.id,
    metadata: { dealId: data.dealId ?? null, customerId: data.customerId },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });

  return created;
}

export async function updateCreditApplication(
  dealershipId: string,
  userId: string,
  id: string,
  data: creditApplicationDb.CreditApplicationUpdateInput,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const existing = await getCreditApplication(dealershipId, id);
  if (existing.status !== "DRAFT" && existing.status !== "READY_TO_SUBMIT") {
    throw new ApiError("CONFLICT", "Only draft or ready applications can be updated");
  }

  const updated = await creditApplicationDb.updateCreditApplication(dealershipId, id, {
    ...data,
    updatedByUserId: userId,
  });
  if (!updated) throw new ApiError("NOT_FOUND", "Credit application not found");

  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "credit_application.updated",
    entity: "CreditApplication",
    entityId: id,
    metadata: { changedFields: Object.keys(data) },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });

  return updated;
}

export async function submitCreditApplication(
  dealershipId: string,
  userId: string,
  id: string,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const existing = await getCreditApplication(dealershipId, id);
  if (existing.status !== "DRAFT" && existing.status !== "READY_TO_SUBMIT") {
    throw new ApiError("CONFLICT", "Only draft or ready applications can be submitted");
  }

  const now = new Date();
  const updated = await creditApplicationDb.updateCreditApplication(dealershipId, id, {
    status: "SUBMITTED",
    submittedAt: now,
    updatedByUserId: userId,
  });
  if (!updated) throw new ApiError("NOT_FOUND", "Credit application not found");

  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "credit_application.submitted",
    entity: "CreditApplication",
    entityId: id,
    metadata: {},
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });

  return updated;
}
