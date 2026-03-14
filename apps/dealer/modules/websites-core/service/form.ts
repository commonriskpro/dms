import * as formDb from "../db/form";
import * as siteDb from "../db/site";
import { ApiError } from "@/lib/auth";
import { requireTenantActiveForRead, requireTenantActiveForWrite } from "@/lib/tenant-status";
import type { UpdateFormInput } from "../db/form";

export async function listForms(dealershipId: string) {
  await requireTenantActiveForRead(dealershipId);
  const site = await siteDb.getSiteByDealership(dealershipId);
  if (!site) throw new ApiError("NOT_FOUND", "Website site not found");
  return formDb.listFormsBySite(site.id);
}

export async function updateForm(
  dealershipId: string,
  formId: string,
  data: UpdateFormInput
) {
  await requireTenantActiveForWrite(dealershipId);
  const form = await formDb.getFormById(dealershipId, formId);
  if (!form) throw new ApiError("NOT_FOUND", "Form not found");
  return formDb.updateForm(formId, data);
}
