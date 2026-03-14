import type { PublishSnapshot, PublicVehicleDetail } from "@dms/contracts";

export function buildPageTitle(
  snapshot: PublishSnapshot,
  page: "home" | "inventory" | "contact",
  override?: string | null
): string {
  const dealerName = snapshot.dealership.name;
  if (override) return `${override} — ${dealerName}`;
  switch (page) {
    case "home":
      return snapshot.seo.defaultTitle
        ? `${dealerName} — ${snapshot.seo.defaultTitle}`
        : dealerName;
    case "inventory":
      return `Browse Inventory — ${dealerName}`;
    case "contact":
      return `Contact Us — ${dealerName}`;
  }
}

export function buildVdpTitle(vehicle: PublicVehicleDetail, dealerName: string): string {
  const parts = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean);
  return `${parts.join(" ")} — ${dealerName}`;
}

export function buildVdpDescription(vehicle: PublicVehicleDetail): string {
  if (vehicle.customDescription) return vehicle.customDescription;
  const parts = [
    vehicle.year,
    vehicle.make,
    vehicle.model,
    vehicle.trim,
    vehicle.mileage ? `${vehicle.mileage.toLocaleString()} miles` : null,
  ].filter(Boolean);
  return `${parts.join(" ")} available at our dealership.`;
}

export function buildCanonicalUrl(base: string, path: string): string {
  const cleanBase = base.replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

export function buildLocalBusinessStructuredData(snapshot: PublishSnapshot, canonicalBase: string) {
  return {
    "@context": "https://schema.org",
    "@type": "AutoDealer",
    name: snapshot.dealership.name,
    url: canonicalBase,
    telephone: snapshot.dealership.phone ?? undefined,
    address: snapshot.dealership.addressLine1
      ? {
          "@type": "PostalAddress",
          streetAddress: snapshot.dealership.addressLine1,
          addressLocality: snapshot.dealership.city ?? undefined,
          addressRegion: snapshot.dealership.state ?? undefined,
          postalCode: snapshot.dealership.zip ?? undefined,
          addressCountry: "US",
        }
      : undefined,
  };
}

export function buildVehicleStructuredData(
  vehicle: PublicVehicleDetail,
  canonicalUrl: string
) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? " " + vehicle.trim : ""}`,
    description: vehicle.customDescription ?? undefined,
    image: vehicle.photos.length > 0 ? vehicle.photos[0] : undefined,
    url: canonicalUrl,
    offers: vehicle.hidePrice
      ? undefined
      : {
          "@type": "Offer",
          priceCurrency: "USD",
          price: vehicle.price
            ? (parseInt(vehicle.price, 10) / 100).toFixed(2)
            : undefined,
          availability: "https://schema.org/InStock",
        },
  };
}

export function buildSitemapEntries(
  snapshot: PublishSnapshot,
  canonicalBase: string,
  vehicleSlugs: string[]
) {
  const base = canonicalBase.replace(/\/$/, "");
  const entries: Array<{ url: string; lastModified: string; changeFrequency: string; priority: number }> = [
    {
      url: base,
      lastModified: snapshot.publishedAt,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${base}/inventory`,
      lastModified: snapshot.publishedAt,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${base}/contact`,
      lastModified: snapshot.publishedAt,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    ...vehicleSlugs.map((slug) => ({
      url: `${base}/vehicle/${slug}`,
      lastModified: snapshot.publishedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
  return entries;
}
