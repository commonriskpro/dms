import type { TemplateDefinition } from "./types";
import type { PublishSnapshot } from "@dms/contracts";
import { ApiError } from "@/lib/auth";

const premiumDefault: TemplateDefinition = {
  key: "premium-default",
  name: "Premium Default",
  description: "Modern dealer website with hero, featured inventory, finance CTA, and lead forms.",
  supportedSections: [
    "hero",
    "featured_inventory",
    "finance_cta",
    "dealership_info",
    "contact_cta",
    "inventory_grid",
    "vdp_gallery",
    "vdp_specs",
    "vdp_pricing",
    "lead_form",
  ],
  defaultSections: ["hero", "featured_inventory", "finance_cta", "dealership_info", "contact_cta"],
  validateSnapshot(snapshot: PublishSnapshot) {
    if (!snapshot.dealership?.name) {
      throw new ApiError("VALIDATION_ERROR", "Dealership name is required before publishing");
    }
    const homePage = snapshot.pages.find((p) => p.pageType === "HOME");
    if (!homePage?.isEnabled) {
      throw new ApiError("VALIDATION_ERROR", "Home page must be enabled before publishing");
    }
  },
};

const REGISTRY = new Map<string, TemplateDefinition>([[premiumDefault.key, premiumDefault]]);

export function getTemplate(key: string): TemplateDefinition | undefined {
  return REGISTRY.get(key);
}

export function requireTemplate(key: string): TemplateDefinition {
  const t = REGISTRY.get(key);
  if (!t) throw new ApiError("VALIDATION_ERROR", `Unknown template key: ${key}`);
  return t;
}

export function listTemplates(): TemplateDefinition[] {
  return Array.from(REGISTRY.values());
}
