/**
 * Public-safe DTOs for apps/websites runtime.
 * These types contain ONLY fields safe to expose to anonymous public visitors.
 * Internal UUIDs, cost/margin fields, and operational metadata are excluded.
 */

// ─── Public Vehicle DTOs ──────────────────────────────────────────────────────

export type PublicVehicleSummary = {
  slug: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  condition: string;
  mileage: number | null;
  price: string | null;       // string cents or null when hidePrice=true
  hidePrice: boolean;
  primaryPhotoUrl: string | null;
  isFeatured: boolean;
  customHeadline: string | null;
  bodyStyle: string | null;
  exteriorColor: string | null;
  stockNumber: string;
};

export type PublicVehicleDetail = PublicVehicleSummary & {
  interiorColor: string | null;
  engine: string | null;
  transmission: string | null;
  drivetrain: string | null;
  vinPartial: string | null;    // last 6 chars only
  photos: string[];             // up to 20 photo URLs
  customDescription: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
};

// ─── Public Inventory Query ───────────────────────────────────────────────────

export type PublicInventoryListResult = {
  data: PublicVehicleSummary[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
};

// ─── Publish Snapshot ─────────────────────────────────────────────────────────

export type SnapshotDealership = {
  name: string;
  phone: string | null;
  email: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  hours: Record<string, string> | null;
};

export type SnapshotTheme = {
  logoUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  headerBgColor: string | null;
  fontFamily: string | null;
};

export type SnapshotSocial = {
  facebook: string | null;
  instagram: string | null;
  twitter: string | null;
  youtube: string | null;
  tiktok: string | null;
};

export type SnapshotPage = {
  pageType: string;
  title: string;
  slug: string;
  isEnabled: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  sectionsConfig: Record<string, unknown> | null;
  sortOrder: number;
};

export type SnapshotForm = {
  formType: string;
  isEnabled: boolean;
};

export type SnapshotInventory = {
  featuredVehicleSlugs: string[];
  vehicleCount: number;
};

export type SnapshotSeo = {
  defaultTitle: string | null;
  defaultDescription: string | null;
  canonicalBase: string | null;
};

export type PublishSnapshot = {
  version: number;
  publishedAt: string;
  templateKey: string;
  dealership: SnapshotDealership;
  theme: SnapshotTheme;
  social: SnapshotSocial;
  pages: SnapshotPage[];
  forms: SnapshotForm[];
  inventory: SnapshotInventory;
  seo: SnapshotSeo;
};

// ─── Public Site Context (resolved at runtime) ────────────────────────────────

export type PublishedSiteContext = {
  siteId: string;
  dealershipId: string;
  subdomain: string;
  templateKey: string;
  snapshot: PublishSnapshot;
  primaryHostname: string;
};
