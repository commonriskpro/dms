/**
 * Compliance forms: generate payload from deal/customer/vehicle; list; update status.
 * Compliance alerts: computed list (missing forms, missing stips, no decision, etc.).
 */
import { prisma } from "@/lib/db";
import * as complianceFormDb from "../db/compliance-form";
import { auditLog } from "@/lib/audit";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";
import * as dealService from "@/modules/deals/service/deal";
import type { ComplianceFormType } from "@prisma/client";

const REQUIRED_FORM_TYPES: ComplianceFormType[] = [
  "PRIVACY_NOTICE",
  "ODOMETER_DISCLOSURE",
  "BUYERS_GUIDE",
  "ARBITRATION",
];

const DECISION_THRESHOLD_DAYS = 7;
const CONTRACTED_MISSING_DOCS_DAYS = 3;

export type ComplianceAlert = {
  type: string;
  dealId: string;
  message: string;
  severity: "warning" | "error" | "info";
};

function buildFormPayload(deal: {
  id: string;
  salePriceCents: bigint;
  customer: { name: string };
  vehicle: { year: number | null; make: string | null; model: string | null; vin: string | null; stockNumber: string };
}) {
  const vehicleDesc = [deal.vehicle.year, deal.vehicle.make, deal.vehicle.model]
    .filter(Boolean)
    .join(" ");
  return {
    dealId: deal.id,
    generatedAt: new Date().toISOString(),
    customerName: deal.customer.name,
    vehicleDescription: vehicleDesc || deal.vehicle.stockNumber,
    vin: deal.vehicle.vin,
    stockNumber: deal.vehicle.stockNumber,
    salePriceCents: deal.salePriceCents.toString(),
  };
}

export async function listComplianceForms(dealershipId: string, dealId: string) {
  await requireTenantActiveForRead(dealershipId);
  await dealService.getDeal(dealershipId, dealId);
  return complianceFormDb.listComplianceFormInstancesByDeal(dealershipId, dealId);
}

export async function getComplianceFormInstance(dealershipId: string, id: string) {
  await requireTenantActiveForRead(dealershipId);
  const instance = await complianceFormDb.getComplianceFormInstanceById(dealershipId, id);
  if (!instance) throw new ApiError("NOT_FOUND", "Compliance form instance not found");
  return instance;
}

export async function generateComplianceForm(
  dealershipId: string,
  userId: string,
  dealId: string,
  formType: ComplianceFormType,
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  const deal = await dealService.getDeal(dealershipId, dealId);
  const dealWithRelations = await prisma.deal.findFirst({
    where: { id: dealId, dealershipId },
    include: {
      customer: { select: { name: true } },
      vehicle: { select: { year: true, make: true, model: true, vin: true, stockNumber: true } },
    },
  });
  if (!dealWithRelations) throw new ApiError("NOT_FOUND", "Deal not found");

  const payload = buildFormPayload(dealWithRelations);
  const now = new Date();

  const existing = await complianceFormDb.findComplianceFormInstanceByDealAndType(
    dealershipId,
    dealId,
    formType
  );

  if (existing) {
    const updated = await complianceFormDb.updateComplianceFormInstance(
      dealershipId,
      existing.id,
      {
        status: "GENERATED",
        generatedPayloadJson: payload as object,
        generatedAt: now,
        updatedByUserId: userId,
      }
    );
    if (!updated) throw new ApiError("NOT_FOUND", "Compliance form instance not found");
    await auditLog({
      dealershipId,
      actorUserId: userId,
      action: "compliance_form.generated",
      entity: "ComplianceFormInstance",
      entityId: updated.id,
      metadata: { dealId, formType },
      ip: meta?.ip,
      userAgent: meta?.userAgent,
    });
    return updated;
  }

  const created = await complianceFormDb.createComplianceFormInstance({
    dealershipId,
    dealId,
    formType,
    status: "GENERATED",
    generatedPayloadJson: payload as object,
    generatedAt: now,
    createdByUserId: userId,
  });

  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "compliance_form.generated",
    entity: "ComplianceFormInstance",
    entityId: created.id,
    metadata: { dealId, formType },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });

  return created;
}

export async function updateComplianceFormInstance(
  dealershipId: string,
  userId: string,
  id: string,
  data: { status: "NOT_STARTED" | "GENERATED" | "REVIEWED" | "COMPLETED"; completedAt?: string | null },
  meta?: { ip?: string; userAgent?: string }
) {
  await requireTenantActiveForWrite(dealershipId);
  await getComplianceFormInstance(dealershipId, id);

  const updated = await complianceFormDb.updateComplianceFormInstance(dealershipId, id, {
    status: data.status,
    completedAt: data.completedAt != null ? new Date(data.completedAt) : undefined,
    updatedByUserId: userId,
  });
  if (!updated) throw new ApiError("NOT_FOUND", "Compliance form instance not found");

  await auditLog({
    dealershipId,
    actorUserId: userId,
    action: "compliance_form.updated",
    entity: "ComplianceFormInstance",
    entityId: id,
    metadata: { status: data.status },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });

  return updated;
}

/**
 * Compute compliance alerts for a dealership, optionally scoped to one deal.
 */
export async function getComplianceAlerts(
  dealershipId: string,
  options: { dealId?: string }
): Promise<ComplianceAlert[]> {
  await requireTenantActiveForRead(dealershipId);
  const alerts: ComplianceAlert[] = [];
  const dealIdFilter = options.dealId;

  const dealIds = await prisma.deal.findMany({
    where: {
      dealershipId,
      deletedAt: null,
      ...(dealIdFilter && { id: dealIdFilter }),
    },
    select: { id: true, status: true, createdAt: true },
  });

  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - DECISION_THRESHOLD_DAYS);
  const contractedThreshold = new Date();
  contractedThreshold.setDate(contractedThreshold.getDate() - CONTRACTED_MISSING_DOCS_DAYS);

  for (const deal of dealIds) {
    const [forms, lenderApps, docCount] = await Promise.all([
      complianceFormDb.listComplianceFormInstancesByDeal(dealershipId, deal.id),
      prisma.lenderApplication.findMany({
        where: { dealershipId, dealId: deal.id },
        include: {
          stipulations: {
            where: { status: { in: ["REQUESTED", "RECEIVED"] } },
          },
        },
      }),
      prisma.dealDocument.count({
        where: { dealershipId, dealId: deal.id },
      }),
    ]);

    const formTypesPresent = new Set(forms.map((f) => f.formType));
    for (const req of REQUIRED_FORM_TYPES) {
      if (!formTypesPresent.has(req)) {
        alerts.push({
          type: "MISSING_COMPLIANCE_FORM",
          dealId: deal.id,
          message: `Missing required form: ${req.replace(/_/g, " ")}`,
          severity: "warning",
        });
      }
    }

    for (const app of lenderApps) {
      if (app.status === "SUBMITTED" && app.submittedAt && app.submittedAt < thresholdDate && !app.decisionedAt) {
        alerts.push({
          type: "LENDER_APP_NO_DECISION",
          dealId: deal.id,
          message: `Lender "${app.lenderName}" submitted with no decision after ${DECISION_THRESHOLD_DAYS} days`,
          severity: "warning",
        });
      }
      if ((app.status === "APPROVED" || app.status === "FUNDED") && app.stipulations.length > 0) {
        alerts.push({
          type: "APPROVED_APP_MISSING_STIPS",
          dealId: deal.id,
          message: `Approved lender "${app.lenderName}" has ${app.stipulations.length} outstanding stipulation(s)`,
          severity: "warning",
        });
      }
    }

    const outstandingStips = await prisma.lenderStipulation.count({
      where: {
        dealershipId,
        lenderApplication: { dealId: deal.id },
        status: { in: ["REQUESTED", "RECEIVED"] },
      },
    });
    if (outstandingStips > 0) {
      alerts.push({
        type: "MISSING_STIPULATIONS",
        dealId: deal.id,
        message: `${outstandingStips} stipulation(s) outstanding`,
        severity: "info",
      });
    }

    if (deal.status === "CONTRACTED" && deal.createdAt < contractedThreshold && docCount === 0) {
      alerts.push({
        type: "CONTRACTED_MISSING_DOCUMENTS",
        dealId: deal.id,
        message: "Contracted deal has no documents in vault",
        severity: "warning",
      });
    }
  }

  return alerts;
}
