import type { DealMode } from "./types";

export type DealWorkspaceFocus = "finance" | "delivery-funding" | "title-dmv";

export function getDealWorkspaceHref(
  dealId: string,
  focus?: DealWorkspaceFocus | null
): string {
  return focus ? `/deals/${dealId}?focus=${focus}` : `/deals/${dealId}`;
}

export function getNewDealRedirectHref(
  dealId: string,
  mode: DealMode
): string {
  return getDealWorkspaceHref(dealId, mode === "FINANCE" ? "finance" : null);
}

export function getDealQueueHref(
  dealId: string,
  focus: Exclude<DealWorkspaceFocus, "finance">
): string {
  return getDealWorkspaceHref(dealId, focus);
}

