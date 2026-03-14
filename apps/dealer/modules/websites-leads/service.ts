import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/auth";
import type { WebsiteLeadSubmission } from "@dms/contracts";

/**
 * Match an existing customer by email or phone within the dealership.
 * Returns the customer ID if found, null otherwise.
 */
async function matchCustomer(
  dealershipId: string,
  email: string,
  phone?: string
): Promise<string | null> {
  const normalizedEmail = email.trim().toLowerCase();

  // Try email match first
  const byEmail = await prisma.customerEmail.findFirst({
    where: {
      value: { equals: normalizedEmail, mode: "insensitive" },
      customer: { dealershipId, deletedAt: null, isDraft: false },
    },
    select: { customerId: true },
  });
  if (byEmail) return byEmail.customerId;

  // Try phone match if provided
  if (phone) {
    const normalizedPhone = phone.replace(/\D/g, "");
    if (normalizedPhone.length >= 7) {
      const byPhone = await prisma.customerPhone.findFirst({
        where: {
          value: { endsWith: normalizedPhone.slice(-7) },
          customer: { dealershipId, deletedAt: null, isDraft: false },
        },
        select: { customerId: true },
      });
      if (byPhone) return byPhone.customerId;
    }
  }

  return null;
}

/**
 * Create a new customer record for a website lead.
 * Uses a minimal set of fields — no PII beyond name/contact.
 */
async function createLeadCustomer(
  dealershipId: string,
  data: { firstName: string; lastName: string; email: string; phone?: string }
): Promise<string> {
  const name = `${data.firstName} ${data.lastName}`.trim();

  // Create customer first, then create related records
  const customer = await prisma.customer.create({
    data: {
      dealershipId,
      name,
      firstName: data.firstName,
      lastName: data.lastName,
      leadSource: "website",
      isDraft: false,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  await prisma.customerEmail.create({
    data: {
      dealershipId,
      customerId: customer.id,
      value: data.email.trim().toLowerCase(),
      isPrimary: true,
    },
  });

  if (data.phone) {
    await prisma.customerPhone.create({
      data: {
        dealershipId,
        customerId: customer.id,
        value: data.phone.trim(),
        isPrimary: true,
      },
    });
  }

  return customer.id;
}

export type SubmitLeadOptions = {
  dealershipId: string;
  siteId: string;
  submission: WebsiteLeadSubmission;
};

export type SubmitLeadResult = {
  ok: true;
  isNewCustomer: boolean;
};

export async function submitLead(options: SubmitLeadOptions): Promise<SubmitLeadResult> {
  const { dealershipId, submission } = options;

  // Anti-spam: honeypot must be empty
  if (submission._hp && submission._hp.length > 0) {
    // Silently succeed to avoid revealing anti-spam mechanism
    return { ok: true, isNewCustomer: false };
  }

  // Validate site exists and form is enabled
  const site = await prisma.websiteSite.findFirst({
    where: { id: options.siteId, dealershipId, deletedAt: null },
    select: { id: true },
  });
  if (!site) throw new ApiError("NOT_FOUND", "Website not found");

  const form = await prisma.websiteLeadForm.findFirst({
    where: { siteId: site.id, formType: submission.formType, isEnabled: true },
    select: { id: true },
  });
  if (!form) throw new ApiError("NOT_FOUND", "This form is not available");

  // Match or create customer
  let customerId = await matchCustomer(dealershipId, submission.email, submission.phone);
  const isNewCustomer = !customerId;

  if (!customerId) {
    customerId = await createLeadCustomer(dealershipId, {
      firstName: submission.firstName,
      lastName: submission.lastName,
      email: submission.email,
      phone: submission.phone,
    });
  }

  // Resolve vehicle context if slug is present
  let vehicleId: string | null = null;
  const vehicleSlug = "vehicleSlug" in submission ? submission.vehicleSlug : undefined;
  if (vehicleSlug) {
    // Best-effort vehicle lookup by matching VIN last 6 in slug
    const vinLast6 = vehicleSlug.split("-").pop()?.toUpperCase();
    if (vinLast6 && vinLast6.length === 6) {
      const vehicle = await prisma.vehicle.findFirst({
        where: { dealershipId, vin: { endsWith: vinLast6 }, deletedAt: null },
        select: { id: true },
      });
      vehicleId = vehicle?.id ?? null;
    }
  }

  // Create customer activity (timeline entry)
  const activityMetadata: Record<string, unknown> = {
    formType: submission.formType,
    pagePath: submission.pagePath ?? null,
    vehicleId: vehicleId ?? null,
    vehicleSlug: vehicleSlug ?? null,
    message: submission.message ?? null,
  };
  if (submission.utmSource) activityMetadata.utmSource = submission.utmSource;
  if (submission.utmMedium) activityMetadata.utmMedium = submission.utmMedium;
  if (submission.utmCampaign) activityMetadata.utmCampaign = submission.utmCampaign;

  await prisma.customerActivity.create({
    data: {
      dealershipId,
      customerId,
      activityType: "website_lead",
      entityType: "WebsiteLeadForm",
      entityId: form.id,
      metadata: activityMetadata as object,
      actorId: null, // public form — no staff actor
    },
  });

  return { ok: true, isNewCustomer };
}
