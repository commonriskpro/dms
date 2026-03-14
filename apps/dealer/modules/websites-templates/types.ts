import type { PublishSnapshot } from "@dms/contracts";

export type TemplateSectionType =
  | "hero"
  | "featured_inventory"
  | "finance_cta"
  | "dealership_info"
  | "contact_cta"
  | "inventory_grid"
  | "vdp_gallery"
  | "vdp_specs"
  | "vdp_pricing"
  | "lead_form";

export type TemplateDefinition = {
  key: string;
  name: string;
  description: string;
  supportedSections: TemplateSectionType[];
  defaultSections: TemplateSectionType[];
  validateSnapshot: (snapshot: PublishSnapshot) => void;
};
